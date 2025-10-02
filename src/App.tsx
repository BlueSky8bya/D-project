// src/App.tsx - 메인 애플리케이션 컴포넌트

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import type { ParseResult, ParseConfig } from "papaparse";

import SurveyResultsViewer from "./features/Response/SurveyResultsViewer"; 
import { parseSurveyFromRow, type SurveyBlock } from "./features/Response/parseSurveyResponses";
import { TARGET_FILES, prettyName, findMetaByFile } from './constants/csvRegistry';
import CsvRouter from './components/CsvRouter';

type DirHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

type CsvFileInfo = { name: string; handle: FileHandle; size?: number };
type Participant = { uid: string; handle: DirHandle; quickCount: number; files?: CsvFileInfo[] };

const TARGET_FILES_SET = new Set<string>(TARGET_FILES);

const CSV_INFO: Record<string, { title: string; desc: string; fields?: string[] }> = {
  'watch_accelerometer': {
    title: '가속도 센서 (watch_accelerometer.csv)',
    desc: '기기의 3축(x, y, z) 방향 움직임 가속도를 기록한 데이터입니다. (단위: m/s²)',
    fields: ['timestamp', 'x', 'y', 'z'],
  },
  'watch_gravity': {
    title: '중력 가속도 센서 (watch_gravity.csv)',
    desc: '기기에 작용하는 중력 가속도를 3축(x, y, z)으로 분해하여 기록한 데이터입니다. (단위: m/s²)',
    fields: ['timestamp', 'x', 'y', 'z'],
  },
  'watch_gyroscope': {
    title: '자이로스코프 센서 (watch_gyroscope.csv)',
    desc: '기기의 3축(x, y, z) 회전 각속도를 기록한 데이터입니다. (단위: rad/s)',
    fields: ['timestamp', 'x', 'y', 'z'],
  },
  'watch_heart_rate': {
    title: '심박수 (watch_heart_rate.csv)',
    desc: '광학 센서로 측정한 분당 심박수(BPM) 데이터입니다.',
    fields: ['timestamp', 'value'],
  },
  'watch_ppg_green': {
    title: 'PPG - 녹색광 (watch_ppg_green.csv)',
    desc: '심박수 측정을 위해 녹색광을 사용하여 수집한 광용적맥파(Photoplethysmography) 원시 신호 데이터입니다.',
    fields: ['timestamp', 'value'],
  },
  'watch_light': {
    title: '조도 센서 (watch_light.csv)',
    desc: '기기 주변의 빛의 밝기(조도)를 측정한 데이터입니다. (단위: lux)',
    fields: ['timestamp', 'value'],
  },
  'watch_step_count': {
    title: '걸음수 (watch_step_count.csv)',
    desc: '특정 시간 동안 누적된 걸음수 데이터입니다. (단위: steps)',
    fields: ['timestamp', 'steps'],
  },
  'sleep_diary': {
    title: '수면일지 (sleep_diary.csv)',
    desc: '사용자가 직접 입력한 주관적인 수면 기록 데이터입니다.',
    fields: ['date', 'sleep_onset', 'wakeTime', 'quality'],
  },
  'ema': {
    title: '순간기분평가 (ema.csv)',
    desc: 'EMA(Ecological Momentary Assessment) 방식으로 특정 순간의 기분·스트레스·불안감에 대한 자가 보고 데이터입니다.',
    fields: ['date', 'mood', 'stress', 'anxiety'],
  },
  'response': {
    title: '설문 응답 (response.csv)',
    desc: `표준화된 심리·건강 관련 설문 응답 데이터입니다.
포함된 설문: PHQ-9(우울증), CES-D(우울척도), GAD-7(불안장애), ISI(불면증), Stress-20(스트레스), INQ(대인관계), WHOQOL-BREF(삶의 질), S-Scale-A(스마트폰 중독), HAM-D(해밀턴 우울증), HAM-A(해밀턴 불안), CNS-VS(신경인지기능)`,
    fields: ['uid', 'week', '각 설문별 문항과 응답'],
  },
};

/* -------- 유틸 -------- */
function pLimit(concurrency: number) {
  let active = 0;
  const q: (() => void)[] = [];
  const next = () => { active--; q.shift()?.(); };
  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((r) => q.push(r));
    active++;
    try { return await fn(); } finally { next(); }
  };
}

/** 브라우저 구현차 고려한 안전한 dir iterator */
async function* dirEntries(dir: DirHandle): AsyncGenerator<[string, FileSystemHandle]> {
  const anyDir = dir as any;
  if (typeof anyDir.entries === "function") {
    // @ts-ignore
    for await (const entry of anyDir.entries()) yield entry as [string, FileSystemHandle];
    return;
  }
  if (typeof anyDir.values === "function") {
    // @ts-ignore
    for await (const handle of anyDir.values()) {
      const name = (handle as any)?.name ?? "unknown";
      yield [name, handle as FileSystemFileHandle | FileSystemDirectoryHandle];
    }
  }
}

/** Papa.parse 콜백 → Promise 래핑 */
type BrowserParseConfig<T = any> = ParseConfig<T> & { worker?: boolean };
const parseCsv = (text: string, cfg: BrowserParseConfig) =>
  new Promise<any[]>((resolve, reject) => {
    Papa.parse(text, {
      ...cfg,
      complete: (res: ParseResult<any>) => resolve(res.data as any[]),
      error: (err: any) => reject(err),
    });
  });

/* -------- 컴포넌트 -------- */
export default function App() {
  const [root, setRoot] = useState<DirHandle | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedCsv, setSelectedCsv] = useState<CsvFileInfo | null>(null);

  // 센서/설문 로드 결과
  const [rows, setRows] = useState<any[] | null>(null);
  const [surveyBlocks, setSurveyBlocks] = useState<SurveyBlock[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanDone, setScanDone] = useState(0);
  const [showCsvInfo, setShowCsvInfo] = useState(false);
  const [fastScan, setFastScan] = useState(true);
  const [detailCache] = useState<Map<string, CsvFileInfo[]>>(new Map());
  const rightTopRef = useRef<HTMLDivElement | null>(null);

  const pickRoot = async () => {
    console.log("폴더 선택 시도...");
    setError(null);
    try {
      const dir = await (window as any).showDirectoryPicker();
      console.log("폴더가 선택되었습니다:", dir.name);
      setRoot(dir);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error("폴더 선택 오류:", e);
        setError("폴더 선택이 취소되었거나 지원되지 않습니다.");
      } else {
        console.log("폴더 선택이 취소되었습니다.");
      }
    }
  };

// FileReader를 Promise로 감싸서 사용하기 위한 헬퍼 함수
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // 'euc-kr'은 CP949를 포함하는, 한글 Windows에서 주로 사용하는 인코딩입니다.
    // 대부분의 한글 깨짐은 이 옵션으로 해결됩니다.
    reader.readAsText(file, 'euc-kr'); 
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

  /* 스캔 */
  useEffect(() => {
    (async () => {
      if (!root) return;
      console.log(`[Effect] 루트 폴더 스캔 시작 (빠른 스캔: ${fastScan})`);
      setSelectedUid(null);
      setSelectedCsv(null);
      setRows(null);
      setSurveyBlocks(null);
      setError(null);

      const list: { uid: string; handle: DirHandle }[] = [];
      for await (const [name, handle] of dirEntries(root as DirHandle)) {
        if (handle.kind === "directory") list.push({ uid: name, handle: handle as DirHandle });
      }
      list.sort((a, b) => a.uid.localeCompare(b.uid));
      setScanTotal(list.length);
      setScanDone(0);

      if (fastScan) {
        const limit = pLimit(16);
        const scanned = await Promise.all(
          list.map((p) =>
            limit(async () => {
              let count = 0;
              for await (const [fname, fhandle] of dirEntries(p.handle)) {
                if (fhandle.kind === "file") {
                  const lower = fname.toLowerCase();
                  if (lower.endsWith(".csv") && TARGET_FILES_SET.has(fname)) count++;
                }
              }
              setScanDone((n) => n + 1);
              return { uid: p.uid, handle: p.handle, quickCount: count } as Participant;
            })
          )
        );
        setParticipants(scanned);
        return;
      }

      const limit = pLimit(10);
      const scanned = await Promise.all(
        list.map((p) =>
          limit(async () => {
            const files: CsvFileInfo[] = [];
            for await (const [fname, fhandle] of dirEntries(p.handle)) {
              if (fhandle.kind === "file" && fname.toLowerCase().endsWith(".csv")) {
                if (TARGET_FILES_SET.has(fname)) files.push({ name: fname, handle: fhandle as FileHandle });
              }
            }
            files.sort((a, b) => a.name.localeCompare(b.name));
            setScanDone((n) => n + 1);
            return { uid: p.uid, handle: p.handle, quickCount: files.length, files } as Participant;
          })
        )
      );
      setParticipants(scanned);
    })();
  }, [root, fastScan]);

  const ensureDetailFor = async (uid: string) => {
    const p = participants.find((x) => x.uid === uid);
    if (!p) return;
    if (detailCache.has(uid)) {
      if (!p.files)
        setParticipants((ps) =>
          ps.map((pp) => (pp.uid === uid ? { ...pp, files: detailCache.get(uid)! } : pp))
        );
      return;
    }
    const files: CsvFileInfo[] = [];
    for await (const [fname, fhandle] of dirEntries(p.handle)) {
      if (fhandle.kind === "file" && fname.toLowerCase().endsWith(".csv")) {
        if (TARGET_FILES_SET.has(fname)) files.push({ name: fname, handle: fhandle as FileHandle });
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    detailCache.set(uid, files);
    setParticipants((ps) =>
      ps.map((pp) => (pp.uid === uid ? { ...pp, files, quickCount: files.length } : pp))
    );
  };

  // CSV 로드
  const loadCsv = async (f: CsvFileInfo) => {
    console.group(`[CSV 로드 시작] ${f.name}`);
    setError(null);
    setSelectedCsv(f);
    setRows(null);
    setSurveyBlocks(null);
    setLoading(true);
    rightTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const file = await f.handle.getFile();
      // file.text() 대신 새로운 FileReader 헬퍼 함수를 사용합니다.
      const text = await readFileAsText(file); 
      console.log(`파일 크기: ${text.length} bytes`);

      // 설문(response.csv)
      if (f.name.toLowerCase() === "response.csv") {
        console.log("설문(response.csv) 파싱을 시작합니다.");
        const rowArray = await parseCsv(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          worker: true,
        });
        console.log(`파싱된 행 개수: ${rowArray.length}`);

        if (!rowArray.length) {
          setSurveyBlocks([]);
        } else {
          // response.csv는 여러 주차의 데이터를 포함할 수 있으므로, 모든 데이터를 파싱하도록 수정합니다.
          const blocks = rowArray.flatMap(row => parseSurveyFromRow(row));
          console.log("모든 설문 블록 파싱 완료:", blocks);
          setSurveyBlocks(blocks);
        }
        setRows(null); // surveyBlocks를 사용하므로 rows는 null로 설정
        return;
      }

      // 센서
      console.log("센서 데이터 파싱을 시작합니다.");
      const sensorRows = await parseCsv(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        worker: true,
      });
      console.log(`파싱된 센서 행 개수: ${sensorRows.length}`, sensorRows.slice(0, 5));
      setRows(sensorRows);
    } catch (e: any) {
      console.error(`[CSV 로드 오류] ${f.name}:`, e);
      setError(`CSV 읽기 오류: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  const summary = useMemo(
    () => ({ total: participants.length, withAny: participants.filter((p) => p.quickCount > 0).length }),
    [participants]
  );

  return (
    <div className="min-h-screen w-full text-stone-900">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-[#9CD39C] bg-[#E7F4E3E6] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="text-sm font-semibold tracking-wide text-stone-900">헬스케어 대시보드</div>
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
              className="rounded-md border border-[#E2D8A1] bg-[#FFF7D6] px-3 py-1 text-xs font-medium hover:bg-[#FFF3C0]"
            >
              폴더 선택
            </button>
            <span className="rounded-full border border-[#E2D8A1] bg-[#FFF2CC] px-3 py-1 text-xs text-amber-900">
              v0.1 · 로컬
            </span>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* 요약 */}
        <section className="rounded-2xl border border-[#E6DCA8] bg-[#FFF5D9] p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold text-green-700">환영합니다 👋</h1>
          <p className="mt-1 text-stone-700">
            {fastScan ? "빠른 스캔 모드: CSV 존재 여부와 개수만 집계합니다." : "상세 스캔 모드: 파일 목록까지 수집합니다."}
          </p>
          {root && scanTotal > 0 && scanDone < scanTotal && (
            <div className="mt-3 rounded-md border border-[#E2D8A1] bg-[#FFF2CC] px-3 py-2 text-xs text-stone-700">
              스캔 중… {scanDone}/{scanTotal}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[#E2D08F] bg-[#FFF0C7] p-4 shadow-sm">
              <div className="text-sm text-stone-700">피험자 수</div>
              <div className="mt-1 text-2xl font-bold text-green-700">{summary.total}명</div>
            </div>
            <div className="rounded-xl border border-[#E2D08F] bg-[#FFF0C7] p-4 shadow-sm">
              <div className="text-sm text-stone-700">CSV 보유 피험자</div>
              <div className="mt-1 text-2xl font-bold text-green-700">{summary.withAny}명</div>
            </div>
            <button
              onClick={() => setShowCsvInfo(true)}
              className="rounded-xl border border-[#E2D08F] bg-[#FFF0C7] p-4 text-left shadow-sm hover:bg-[#FFF2CC]"
              title="지원 CSV 설명 보기"
            >
              <div className="text-sm text-stone-700">지원 CSV 종류</div>
              <div className="mt-1 text-2xl font-bold text-green-700">{TARGET_FILES.length}개</div>
              <div className="mt-1 text-xs text-stone-600">클릭하여 설명 보기</div>
            </button>
            <div className="rounded-xl border border-[#E2D08F] bg-[#FFF0C7] p-4 shadow-sm">
              <div className="text-sm text-stone-700">상태</div>
              <div className="mt-1 text-2xl font-bold text-green-700">{root ? "폴더 연결됨" : "대기"}</div>
            </div>
          </div>
        </section>

        {/* 2단 레이아웃 */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* 좌: UID 리스트 */}
          <div className="max-h-[65vh] overflow-auto rounded-2xl border border-[#E6DCA8] bg-[#FFF5D9] p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-stone-800">피험자 폴더 (UID)</h2>
            <div className="grid grid-cols-1 gap-2">
              {participants.map((p) => (
                <button
                  key={p.uid}
                  onClick={async () => {
                    setSelectedUid(p.uid);
                    setSelectedCsv(null);
                    setRows(null);
                    setSurveyBlocks(null);
                    rightTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    await ensureDetailFor(p.uid);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left shadow-sm hover:bg-[#E6F4E4]
                    ${selectedUid === p.uid ? "border-[#B7E0B5] bg-[#E6F4E4]" : "border-[#E2D08F] bg-[#FFF0C7]"}`}
                >
                  <div className="text-sm font-semibold text-stone-800 truncate">{p.uid}</div>
                  <div className="mt-1 text-xs text-stone-600">{p.quickCount ? `${p.quickCount}개 CSV` : "없음"}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 우: CSV 목록 & 뷰어 */}
          <div ref={rightTopRef} className="rounded-2xl border border-[#E6DCA8] bg-[#FFF5D9] p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-stone-800">
              {selectedUid ? <>피험자 UID · <span className="text-green-700">{selectedUid}</span></> : "피험자 UID"}
            </h2>

            {selectedUid ? (() => {
              const p = participants.find((x) => x.uid === selectedUid);
              if (!p) return null;
              if (!p.files) {
                return (
                  <div className="rounded-md border border-[#E2D8A1] bg-[#FFF2CC] px-3 py-2 text-sm text-stone-700">
                    상세 정보 불러오는 중…
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {p.files.map((f) => {
                    const base = f.name.replace(".csv", "");
                    return (
                      <div key={f.name} className="flex items-center justify-between rounded-lg border border-[#E2D08F] bg-[#FFF0C7] px-3 py-2 shadow-sm">
                        <div>
                          <div className="text-sm font-medium text-stone-800">{prettyName(base)}</div>
                          <div className="text-xs text-stone-600">{f.name}</div>
                        </div>
                        <button
                          onClick={() => loadCsv(f)}
                          className="rounded-md border border-[#B7E0B5] bg-[#E6F4E4] px-3 py-1 text-xs font-medium text-[#2F6B2F] hover:bg-[#DDF0DA]"
                          title="보기"
                        >
                          보기
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })() : (
              <div className="rounded-md border border-[#E2D8A1] bg-[#FFF2CC] px-3 py-2 text-sm text-stone-700">
                먼저 왼쪽에서 UID를 선택하세요.
              </div>
            )}

            {selectedCsv && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-stone-800">
                    {selectedCsv.name.toLowerCase() === "response.csv" ? (
                      <>설문 · <span className="text-green-700">설문 응답</span></>
                    ) : (
                      <>차트 · <span className="text-green-700">{prettyName(selectedCsv.name)}</span></>
                    )}
                  </h3>
                  {loading && <span className="text-xs text-stone-600">불러오는 중…</span>}
                </div>

                {error && (
                  <div className="mb-3 rounded-md border border-[#E2D8A1] bg-[#FFF2CC] px-3 py-2 text-sm text-amber-900">
                    {error}
                  </div>
                )}

                {(() => {
                  if (loading) return null;

                  // response.csv 전용: surveyBlocks가 필요(빈 경우 안내 메시지)
                  if (findMetaByFile(selectedCsv.name)?.id === "survey") {
                    return (surveyBlocks && surveyBlocks.length > 0) ? (
                      <div className="rounded-lg border border-[#E2D08F] bg-white/70 p-3">
                        <SurveyResultsViewer surveyBlocks={surveyBlocks} />
                      </div>
                    ) : (
                      <div className="mt-2 rounded-md border border-[#E2D8A1] bg-[#FFF2CC] px-3 py-2 text-sm text-stone-700">
                        표시할 설문 응답이 없습니다.
                      </div>
                    );
                  }

                  // 나머지(EMA, 수면일지, 모든 센서류 포함)는 CsvRouter가 처리
                  if (rows && rows.length > 0) {
                    return (
                      <div className="rounded-lg border border-[#E2D08F] bg-white/70 p-2">
                        <CsvRouter
                          fileName={selectedCsv.name}
                          rows={rows ?? []}
                          surveyBlocks={surveyBlocks ?? []}
                        />
                      </div>
                    );
                  }

                  return (
                    <div className="mt-2 rounded-md border border-[#E2D8A1] bg-[#FFF2CC] px-3 py-2 text-sm text-stone-700">
                      데이터가 없거나, 파싱할 숫자열을 찾지 못했어요.
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </section>

        <footer className="mt-8 flex items-center justify-between text-xs text-stone-700">
          <span>© 2025 헬스케어 대시보드</span>
          <span className="text-stone-600">아이보리 단계 대비: 배경 #FFF7E6 · 패널 #FFF5D9 · 카드 #FFF0C7</span>
        </footer>
      </main>

      {/* 지원 CSV 안내 모달 */}
      {showCsvInfo && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-[#E6DCA8] bg-[#FFF5D9] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-stone-900">지원 CSV 설명</h3>
              <button
                onClick={() => setShowCsvInfo(false)}
                className="rounded-md border border-[#E2D8A1] bg-[#FFF7D6] px-3 py-1 text-xs hover:bg-[#FFF3C0]"
              >
                닫기
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {TARGET_FILES.map((fname) => {
                const base = fname.replace(".csv", "");
                const info = CSV_INFO[base] || { title: base, desc: "" };
                return (
                  <div key={fname} className="rounded-lg border border-[#E2D08F] bg-[#FFF0C7] p-3">
                    <div className="text-sm font-semibold text-stone-900">
                      {info.title} <span className="ml-2 text-xs text-stone-600">({fname})</span>
                    </div>
                    {info.desc && <div className="mt-1 text-sm text-stone-700">{info.desc}</div>}
                    {info.fields && (
                      <div className="mt-1 text-xs text-stone-600">
                        주요 컬럼: <code>{info.fields.join(", ")}</code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}