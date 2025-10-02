// src/utils/parseEMA.ts

export type EMA = {
  ts: number;         // epoch ms
  mood?: number;      // 0~100
  stress?: number;    // 0~100
  anxiety?: number;   // 0~100
  context?: string;
};

const toEpoch = (v: any) => {
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return isNaN(t) ? NaN : t;
};

const norm01 = (v: any) => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (isNaN(n)) return undefined;
  // 1~5 척도면 0~100으로 선형 매핑
  if (n >= 1 && n <= 5) return ((n - 1) / 4) * 100;
  if (n <= 1) return 0;
  if (n >= 100) return 100;
  return Math.max(0, Math.min(100, n)); // 이미 0~100일 수도 있음
};

export function normalizeEMA(rows: any[]): EMA[] {
  console.log('[normalizeEMA] EMA 데이터 정규화 시작, 입력 행:', rows.slice(0, 5));
  const results = rows.map(r => ({
    ts: toEpoch(r.timestamp ?? r.time ?? r.ts),
    mood: norm01(r.mood),
    stress: norm01(r.stress),
    anxiety: norm01(r.anxiety),
    context: r.context ?? r.activity ?? r.note ?? undefined,
  })).filter(x => !isNaN(x.ts));
  console.log('[normalizeEMA] 정규화 완료, 결과:', results.slice(0, 5));
  return results;
}
