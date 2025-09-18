import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid,
} from 'recharts'

type DirHandle = FileSystemDirectoryHandle
type FileHandle = FileSystemFileHandle

type CsvFileInfo = {
  name: string
  handle: FileHandle
  size?: number
}

type Participant = {
  uid: string
  handle: DirHandle
  // 빠른 스캔: 개수만
  quickCount: number
  // 상세 스캔: 파일 목록 (없으면 아직 미스캔)
  files?: CsvFileInfo[]
}

const TARGET_FILES = [
  'watch_accelerometer.csv',
  'watch_gravity.csv',
  'watch_gyroscope.csv',
  'watch_heart_rate.csv',
  'watch_light.csv',
  'watch_ppg_green.csv',
  'response.csv',
] as const

const CSV_INFO: Record<string, { title: string; desc: string; fields?: string[] }> = {
  watch_accelerometer: { title: '가속도계', desc: '삼축 선형가속도 (x,y,z). 보행/활동 강도 추정.', fields: ['timestamp', 'x', 'y', 'z', 'test'] },
  watch_gravity:       { title: '중력',     desc: '기기 축의 중력 성분 (X,Y,Z). 자세/방향 보정.', fields: ['time|timestamp', 'X', 'Y', 'Z', 'x', 'y', 'z'] },
  watch_gyroscope:     { title: '자이로',   desc: '각속도 (X,Y,Z). 회전/움직임 패턴.', fields: ['time|timestamp', 'X', 'Y', 'Z', 'x', 'y', 'z'] },
  watch_heart_rate:    { title: '심박',     desc: '심박수(bpm). 휴식/운동/스트레스.', fields: ['time|timestamp', 'value|data'] },
  watch_light:         { title: '조도',     desc: '환경 조도(lux 유사). 수면/활동 컨텍스트.', fields: ['time|timestamp', 'value|data'] },
  watch_ppg_green:     { title: 'PPG(녹색)', desc: '광용적맥파 원시값. 심박/HRV 추정 원천.', fields: ['time|timestamp', 'value|data'] },
  response:            { title: '설문 응답', desc: 'PHQ-9 등 설문/메타데이터.', fields: ['uid', 'week', 'PHQ-9.*', 'lastUpdate'] },
}

/* ---------------- 유틸 ---------------- */
function pLimit(concurrency: number) {
  let active = 0
  const queue: (() => void)[] = []
  const next = () => {
    active--
    if (queue.length) queue.shift()!()
  }
  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((r) => queue.push(r))
    active++
    try { return await fn() } finally { next() }
  }
}

async function* dirEntries(dir: DirHandle): AsyncGenerator<[string, FileSystemHandle]> {
  const anyDir: any = dir as any
  const it = typeof anyDir.entries === 'function' ? anyDir.entries() : anyDir[Symbol.asyncIterator]?.()
  if (it) {
    // @ts-ignore
    for await (const entry of it) yield entry as [string, FileSystemHandle]
    return
  }
  const vit = typeof anyDir.values === 'function' ? anyDir.values() : null
  if (vit) {
    // @ts-ignore
    for await (const h of vit) {
      const handle = h as FileSystemHandle
      const name = (handle as any).name ?? 'unknown'
      yield [name, handle]
    }
  }
}

async function parseCsvFile(handle: FileHandle): Promise<any[]> {
  const file = await handle.getFile()
  const text = await file.text()
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      worker: true,
      complete: (res: any) => resolve(res.data as any[]),
      error: (err: unknown) => reject(err),
    })
  })
}

function guessNumericKeys(rows: any[], prefer: string[] = ['value', 'data', 'x', 'y', 'z', 'X', 'Y', 'Z']) {
  if (!rows?.length) return []
  const sample = rows[0]
  const keys = Object.keys(sample)
  const numeric = keys.filter((k) => typeof sample[k] === 'number')
  numeric.sort((a, b) => {
    const ia = prefer.indexOf(a); const ib = prefer.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  return numeric
}
function guessTimeKey(rows: any[], prefer: string[] = ['timestamp', 'time', 'date', 'datetime', 'createdAt']) {
  if (!rows?.length) return undefined
  const keys = Object.keys(rows[0])
  for (const p of prefer) if (keys.includes(p)) return p
  return undefined
}
function prettyName(name: string) {
  const map: Record<string, string> = {
    watch_accelerometer: '가속도계',
    watch_gravity: '중력',
    watch_gyroscope: '자이로',
    watch_heart_rate: '심박',
    watch_light: '조도',
    watch_ppg_green: 'PPG(녹색)',
    response: '설문 응답',
  }
  const base = name.replace(/\.csv$/i, '')
  return map[base] ?? base
}

/* ---------------- 컴포넌트 ---------------- */
export default function App() {
  const [root, setRoot] = useState<DirHandle | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [selectedCsv, setSelectedCsv] = useState<CsvFileInfo | null>(null)
  const [rows, setRows] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [scanTotal, setScanTotal] = useState(0)
  const [scanDone, setScanDone] = useState(0)
  const [showCsvInfo, setShowCsvInfo] = useState(false)

  // 빠른 스캔 모드 토글 (기본: 켜짐)
  const [fastScan, setFastScan] = useState(true)

  // 상세 결과 캐시 (UID → files[])
  const [detailCache] = useState<Map<string, CsvFileInfo[]>>(new Map())

  const rightTopRef = useRef<HTMLDivElement | null>(null)

  const pickRoot = async () => {
    setError(null)
    try {
      const dir = await (window as any).showDirectoryPicker()
      setRoot(dir)
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError('폴더 선택이 취소되었거나 지원되지 않습니다.')
    }
  }

  /* ---------- 1) 루트 선택 또는 모드 변경 → 스캔 ---------- */
  useEffect(() => {
    (async () => {
      if (!root) return
      setSelectedUid(null)
      setSelectedCsv(null)
      setRows(null)
      setError(null)

      // 1-1) 1-depth UID 폴더 수집
      const list: { uid: string; handle: DirHandle }[] = []
      for await (const [name, handle] of dirEntries(root as DirHandle)) {
        if (handle.kind === 'directory') list.push({ uid: name, handle: handle as DirHandle })
      }
      list.sort((a, b) => a.uid.localeCompare(b.uid))

      setScanTotal(list.length)
      setScanDone(0)

      // 1-2) 빠른 스캔 모드: 파일명만 확인해서 개수만 집계
      if (fastScan) {
        const limit = pLimit(16)
        const scanned = await Promise.all(
          list.map((p) =>
            limit(async () => {
              let count = 0
              for await (const [fname, fhandle] of dirEntries(p.handle)) {
                if (fhandle.kind === 'file') {
                  const lower = fname.toLowerCase()
                  if (lower.endsWith('.csv') && TARGET_FILES.includes(fname as any)) count++
                }
              }
              setScanDone((n) => n + 1)
              return { uid: p.uid, handle: p.handle, quickCount: count } as Participant
            })
          )
        )
        setParticipants(scanned)
        return
      }

      // 1-3) 상세 스캔 모드: 처음부터 파일 목록까지 수집 (느리지만 상세)
      const limit = pLimit(10)
      const scanned = await Promise.all(
        list.map((p) =>
          limit(async () => {
            const files: CsvFileInfo[] = []
            for await (const [fname, fhandle] of dirEntries(p.handle)) {
              if (fhandle.kind === 'file' && fname.toLowerCase().endsWith('.csv')) {
                if (TARGET_FILES.includes(fname as any)) {
                  files.push({ name: fname, handle: fhandle as FileHandle })
                }
              }
            }
            files.sort((a, b) => a.name.localeCompare(b.name))
            setScanDone((n) => n + 1)
            return { uid: p.uid, handle: p.handle, quickCount: files.length, files } as Participant
          })
        )
      )
      setParticipants(scanned)
    })()
  }, [root, fastScan])

  /* ---------- 2) UID 클릭 → 그 UID만 상세 스캔(캐시) ---------- */
  const ensureDetailFor = async (uid: string) => {
    const p = participants.find((x) => x.uid === uid)
    if (!p) return
    if (detailCache.has(uid)) {
      // 캐시 적용
      if (!p.files) {
        const updated = participants.map((pp) => (pp.uid === uid ? { ...pp, files: detailCache.get(uid)! } : pp))
        setParticipants(updated)
      }
      return
    }
    // 상세 스캔
    const files: CsvFileInfo[] = []
    for await (const [fname, fhandle] of dirEntries(p.handle)) {
      if (fhandle.kind === 'file' && fname.toLowerCase().endsWith('.csv')) {
        if (TARGET_FILES.includes(fname as any)) files.push({ name: fname, handle: fhandle as FileHandle })
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name))
    detailCache.set(uid, files)
    const updated = participants.map((pp) => (pp.uid === uid ? { ...pp, files, quickCount: files.length } : pp))
    setParticipants(updated)
  }

  /* ---------- 3) CSV 로딩/차트 ---------- */
  const loadCsv = async (f: CsvFileInfo) => {
    setError(null)
    setSelectedCsv(f)
    setRows(null)
    setLoading(true)
    rightTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    try {
      const data = await parseCsvFile(f.handle)
      setRows(data)
    } catch (e: any) {
      setError(`CSV 읽기 오류: ${String(e?.message || e)}`)
    } finally {
      setLoading(false)
    }
  }

  const timeKey = useMemo(() => guessTimeKey(rows ?? []), [rows])
  const valueKeys = useMemo(() => guessNumericKeys(rows ?? []), [rows])
  const seriesColors = ['#16a34a', '#65a30d', '#f59e0b', '#10b981', '#84cc16']

  const summary = useMemo(() => {
    const total = participants.length
    const withAny = participants.filter((p) => p.quickCount > 0).length
    return { total, withAny }
  }, [participants])

  return (
    <div className="min-h-screen w-full text-stone-900">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="text-sm font-semibold tracking-wide">헬스케어 대시보드</div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-stone-700">
              <input
                type="checkbox"
                className="accent-green-600"
                checked={fastScan}
                onChange={(e) => setFastScan(e.target.checked)}
              />
              빠른 스캔 모드
            </label>
            <button
              onClick={pickRoot}
              className="rounded-md border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium hover:bg-amber-200"
            >
              폴더 선택
            </button>
            <span className="rounded-full border border-green-300 bg-green-100 px-3 py-1 text-xs text-green-700">
              v0.1 · 로컬
            </span>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="mx-auto w-full max-w-6xl px-6 py-8 bg-amber-50">
        {/* 요약 */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold text-green-700">환영합니다 👋</h1>
          <p className="mt-1 text-stone-700">
            {fastScan ? '빠른 스캔 모드: CSV 존재 여부와 개수만 집계합니다.' : '상세 스캔 모드: 파일 목록까지 수집합니다.'}
          </p>
          {root && scanTotal > 0 && scanDone < scanTotal && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-stone-700">
              스캔 중… {scanDone}/{scanTotal}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="text-sm text-stone-700">피험자 수</div>
              <div className="mt-1 text-2xl font-bold text-green-700">{summary.total}명</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="text-sm text-stone-700">CSV 보유 피험자</div>
              <div className="mt-1 text-2xl font-bold text-green-700">{summary.withAny}명</div>
            </div>
            <button
              onClick={() => setShowCsvInfo(true)}
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left shadow-sm hover:bg-amber-100"
              title="지원 CSV 설명 보기"
            >
              <div className="text-sm text-stone-700">지원 CSV 종류</div>
              <div className="mt-1 text-2xl font-bold text-green-700">{TARGET_FILES.length}개</div>
              <div className="mt-1 text-xs text-stone-600">클릭하여 설명 보기</div>
            </button>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="text-sm text-stone-700">상태</div>
              <div className="mt-1 text-2xl font-bold text-green-700">{root ? '폴더 연결됨' : '대기'}</div>
            </div>
          </div>
        </section>

        {/* 2단 레이아웃 */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* 좌: UID 리스트 */}
          <div className="max-h-[65vh] overflow-auto rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-stone-800">피험자 폴더 (UID)</h2>
            <div className="grid grid-cols-1 gap-2">
              {participants.map((p) => (
                <button
                  key={p.uid}
                  onClick={async () => {
                    setSelectedUid(p.uid)
                    setSelectedCsv(null)
                    setRows(null)
                    rightTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    await ensureDetailFor(p.uid)  // <- 클릭 시 상세 스캔
                  }}
                  className={`rounded-lg border px-3 py-2 text-left shadow-sm hover:bg-amber-100
                    ${selectedUid === p.uid ? 'border-green-400 bg-amber-100' : 'border-amber-200 bg-amber-50'}`}
                >
                  <div className="text-sm font-semibold text-stone-800 truncate">{p.uid}</div>
                  <div className="mt-1 text-xs text-stone-600">
                    {p.quickCount ? `${p.quickCount}개 CSV` : '없음'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 우: CSV 목록 & 차트 */}
          <div ref={rightTopRef} className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-stone-800">
              {selectedUid ? <>CSV 파일 · <span className="text-green-700">{selectedUid}</span></> : 'CSV 파일'}
            </h2>

            {selectedUid ? (
              (() => {
                const p = participants.find((x) => x.uid === selectedUid)
                if (!p) return null
                if (!p.files) {
                  return (
                    <div className="rounded-md border border-amber-200 bg-amber-100 px-3 py-2 text-sm text-stone-700">
                      상세 정보 불러오는 중…
                    </div>
                  )
                }
                return (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {p.files.map((f) => {
                      const base = f.name.replace('.csv', '')
                      return (
                        <div key={f.name} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm">
                          <div>
                            <div className="text-sm font-medium text-stone-800">{prettyName(base)}</div>
                            <div className="text-xs text-stone-600">{f.name}</div>
                          </div>
                          <button
                            onClick={() => loadCsv(f)}
                            className="rounded-md border border-green-300 bg-green-100 px-3 py-1 text-xs font-medium text-green-800 hover:bg-green-200"
                            title="차트로 보기"
                          >
                            차트
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })()
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-100 px-3 py-2 text-sm text-stone-700">
                먼저 왼쪽에서 UID를 선택하세요.
              </div>
            )}

            {selectedCsv && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-stone-800">
                    차트 · <span className="text-green-700">{prettyName(selectedCsv.name.replace('.csv',''))}</span>
                  </h3>
                  {loading && <span className="text-xs text-stone-600">불러오는 중…</span>}
                </div>

                {error && <div className="mb-3 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900">{error}</div>}

                {!loading && rows && rows.length > 0 ? (
                  <div className="h-[360px] w-full rounded-lg border border-amber-200 bg-white/70 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      {timeKey ? (
                        <LineChart data={rows.slice(0, 5000)}>
                          <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" />
                          <XAxis dataKey={timeKey} tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          {valueKeys.slice(0, 3).map((k, idx) => (
                            <Line key={k} type="monotone" dataKey={k} stroke={seriesColors[idx % seriesColors.length]} dot={false} strokeWidth={1.6} />
                          ))}
                        </LineChart>
                      ) : (
                        <AreaChart data={(rows as any[]).map((r, i) => ({ idx: i, ...r })).slice(0, 5000)}>
                          <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" />
                          <XAxis dataKey="idx" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          {valueKeys.slice(0, 2).map((k, idx) => (
                            <Area key={k} type="monotone" dataKey={k}
                              stroke={seriesColors[idx % seriesColors.length]}
                              fill={seriesColors[idx % seriesColors.length] + '55'}
                              strokeWidth={1.6} />
                          ))}
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                ) : !loading ? (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-100 px-3 py-2 text-sm text-stone-700">
                    데이터가 없거나, 파싱할 숫자열을 찾지 못했어요.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* 푸터 */}
        <footer className="mt-8 flex items-center justify-between text-xs text-stone-700">
          <span>© 2025 헬스케어 대시보드</span>
          <span className="text-stone-600">아이보리 배경 · 녹색 포인트 · 앰버 보조</span>
        </footer>
      </main>

      {/* 지원 CSV 안내 모달 */}
      {showCsvInfo && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-stone-900">지원 CSV 설명</h3>
              <button onClick={() => setShowCsvInfo(false)}
                className="rounded-md border border-amber-300 bg-amber-100 px-3 py-1 text-xs hover:bg-amber-200">
                닫기
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {TARGET_FILES.map((fname) => {
                const base = fname.replace('.csv', '')
                const info = CSV_INFO[base] || { title: base, desc: '' }
                return (
                  <div key={fname} className="rounded-lg border border-amber-200 bg-white/70 p-3">
                    <div className="text-sm font-semibold text-stone-900">
                      {info.title} <span className="ml-2 text-xs text-stone-600">({fname})</span>
                    </div>
                    {info.desc && <div className="mt-1 text-sm text-stone-700">{info.desc}</div>}
                    {info.fields && (
                      <div className="mt-1 text-xs text-stone-600">
                        주요 컬럼: <code>{info.fields.join(', ')}</code>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
