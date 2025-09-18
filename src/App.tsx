import { useState } from 'react'

/** KPI 카드: 아이보리 톤 배경 + 녹색 포인트 */
function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm hover:bg-amber-100 transition-colors">
      <div className="text-sm text-stone-700">{label}</div>
      <div className="mt-1 text-2xl font-bold text-green-700">{value}</div>
      {sub && <div className="mt-1 text-xs text-stone-600">{sub}</div>}
    </div>
  )
}

export default function App() {
  const [count, setCount] = useState(0)

  // 막대 색상을 녹색 계열로 살짝씩 변주 (눈 피로 줄이기)
  const barClasses = [
    'bg-green-500', 'bg-lime-500', 'bg-green-400', 'bg-lime-400',
    'bg-green-500', 'bg-lime-500', 'bg-green-400', 'bg-lime-400',
    'bg-green-500', 'bg-lime-500', 'bg-green-400', 'bg-lime-400',
  ]

  return (
    <div className="min-h-screen w-full text-stone-900">
      {/* 상단바: 연한 아이보리 */}
      <header className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="text-sm font-semibold tracking-wide">헬스케어 대시보드</div>
          <span className="rounded-full border border-green-300 bg-green-100 px-3 py-1 text-xs text-green-700">
            v0.1 · 테스트
          </span>
        </div>
      </header>

      {/* 본문: 아이보리 베이스 */}
      <main className="mx-auto w-full max-w-6xl px-6 py-8 bg-amber-50">
        {/* 히어로: 살짝 더 밝은 아이보리 카드 */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-3xl font-extrabold tracking-tight text-green-700">
            환영합니다 👋
          </h1>
          <p className="mt-2 text-stone-700">오늘의 주요 지표와 상태를 빠르게 확인하세요.</p>

          {/* 액션 */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => setCount((c) => c + 1)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              증가 · {count}
            </button>
            <button className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-amber-200">
              CSV 내보내기
            </button>
            <span className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-900">
              팁: <kbd className="rounded bg-amber-200 px-1">R</kbd> 키를 눌러 새로고침
            </span>
          </div>
        </section>

        {/* KPI */}
        <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="활성 사용자" value="1,245명" sub="어제 대비 +3.1%" />
          <Kpi label="평균 사용시간" value="4분 12초" sub="+0.6%" />
          <Kpi label="전환율" value="3.2%" sub="+0.3pp" />
          <Kpi label="에러 건수" value="12건" sub="오늘 -5" />
        </section>

        {/* 두 컬럼 */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* 좌: 차트 카드 (아이보리Tint 배경) */}
          <div className="lg:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-800">월간 추세</h2>
              <span className="text-xs text-stone-600">2분 전 업데이트</span>
            </div>

            {/* 막대 차트 */}
            <div className="mt-2 grid grid-cols-12 items-end gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-t ${barClasses[i]}`}
                  style={{ height: `${40 + Math.random() * 80}px` }}
                  title={`${i + 1}월`}
                />
              ))}
            </div>
            <div className="mt-3 text-xs text-stone-600">* 임시 차트 (랜덤 데이터)</div>
          </div>

          {/* 우: 표 카드 */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-stone-800">최근 지표</h2>

            {/* 표: 아이보리 계열로 톤 맞춤 */}
            <div className="overflow-hidden rounded-lg border border-amber-200">
              <table className="w-full text-sm">
                {/* 헤더: 은은한 앰버 배경 + 진한 텍스트 */}
                <thead className="bg-amber-100 text-left text-stone-800">
                  <tr className="border-b border-amber-200">
                    <th className="px-3 py-2">지표</th>
                    <th className="px-3 py-2">값</th>
                    <th className="px-3 py-2">업데이트</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['활성 사용자', '1,245명', '2025-09-18'],
                    ['전환율', '3.2 %', '2025-09-18'],
                    ['이탈률', '24.5 %', '2025-09-18'],
                    ['세션 수', '3,902', '2025-09-17'],
                  ].map((row, i) => (
                    <tr
                      key={i}
                      className={
                        // 줄무늬 + 호버
                        `border-b border-amber-200 
                         ${i % 2 === 0 ? 'bg-amber-50' : 'bg-amber-100/60'} 
                         hover:bg-amber-200/50`
                      }
                    >
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-stone-800">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {/* 푸터 라인(옵션) */}
                <tfoot>
                  <tr className="bg-amber-100/60 border-t border-amber-200">
                    <td colSpan={3} className="px-3 py-2 text-xs text-stone-700">
                      데이터는 예시입니다.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* 푸터 */}
        <footer className="mt-8 flex items-center justify-between text-xs text-stone-700">
          <span>© 2025 헬스케어 대시보드</span>
          <span className="text-stone-600">아이보리 배경 · 녹색 포인트 · 앰버 보조</span>
        </footer>
      </main>
    </div>
  )
}
