// src/features/StepCount/parseStepCount.ts

export type StepPoint = { ts: number; steps: number };
export type StepDaily = { date: string; total: number };

const toMs = (v: any) => {
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return isNaN(t) ? NaN : t;
};

export function normalizeStepCount(rows: any[]): { points: StepPoint[]; daily: StepDaily[] } {
  // ✅ 추가된 부분: 함수 시작 시 입력 데이터 확인
  console.log('[normalizeStepCount] 걸음수 데이터 정규화 시작, 입력 행:', rows.slice(0, 5));
  
  const points: StepPoint[] = rows.map(r => {
    const steps = Number(r.steps ?? r.count ?? 0) || 0;
    let ts = toMs(r.timestamp ?? r.time ?? r.ts);
    const st = toMs(r.start_time ?? r.start);
    const ed = toMs(r.end_time ?? r.end);

    // 구간형이면 중간값 사용
    if (isNaN(ts) && !isNaN(st) && !isNaN(ed)) ts = Math.round((st + ed) / 2);

    return (!isNaN(ts)) ? { ts, steps } : null;
  }).filter(Boolean) as StepPoint[];

  // 일별 합계
  const dailyMap = new Map<string, number>();
  for (const p of points) {
    const d = new Date(p.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + p.steps);
  }
  const daily: StepDaily[] = [...dailyMap.entries()]
    .sort((a,b)=>a[0]<b[0]? -1: 1)
    .map(([date, total]) => ({ date, total }));

  const result = { points, daily };

  // ✅ 추가된 부분: 함수 완료 시 결과 데이터 확인
  console.log('[normalizeStepCount] 정규화 완료, 결과:', {
    points: result.points.slice(0, 5),
    daily: result.daily.slice(0, 5),
  });

  return result;
}
