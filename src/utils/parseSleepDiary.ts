// src/utils/parseSleepDiary.ts

export type SleepDiary = {
  date: string;          // YYYY-MM-DD
  sleepOnset: number;    // epoch ms
  wakeTime: number;      // epoch ms
  totalSleepMin: number;
  latencyMin?: number;
  wasoMin?: number;
  efficiencyPct?: number;
  quality?: number;
  onsetHour: number;     // 0~24
  wakeHour: number;      // 0~24
};

const toMs = (v: any) => {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v; // epoch 가능성
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.getTime();
  return NaN;
};

const hhmmToMs = (dateStr: string, hhmm: string) => {
  // hh:mm, HH:mm:ss 등 → date와 합성
  const base = new Date(dateStr);
  if (isNaN(base.getTime())) return NaN;
  const parts = hhmm.trim().split(':').map(Number);
  if (parts.length < 2) return NaN;
  base.setHours(parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, 0);
  return base.getTime();
};

export function normalizeSleepDiary(rows: any[]): SleepDiary[] {
  return rows.map((r) => {
    const date = String(r.date ?? r.day ?? '').slice(0, 10);

    const onsetRaw = r.sleep_onset ?? r.bedtime ?? r.sleepOnset ?? r.onset; // 변종
    const endRaw   = r.sleep_end   ?? r.wake_time ?? r.wakeTime ?? r.offset;

    let onset = toMs(onsetRaw);
    let wake  = toMs(endRaw);

    if (isNaN(onset) && typeof onsetRaw === 'string' && date) onset = hhmmToMs(date, onsetRaw);
    if (isNaN(wake)  && typeof endRaw   === 'string' && date) wake  = hhmmToMs(date, endRaw);

    // 자정 넘김 케이스 보정(기상 < 취침이면 +24h)
    if (!isNaN(onset) && !isNaN(wake) && wake < onset) wake += 24 * 60 * 60 * 1000;

    const latency = Number(r.latency_min ?? r.latency ?? NaN);
    const waso    = Number(r.waso_min ?? r.waso ?? NaN);

    const core = !isNaN(onset) && !isNaN(wake) ? (wake - onset) / 60000 : NaN;
    const total = isNaN(core) ? NaN : Math.max(core - (isNaN(waso) ? 0 : waso), 0);

    const onsetHour = !isNaN(onset) ? new Date(onset).getHours() + new Date(onset).getMinutes()/60 : NaN;
    const wakeHour  = !isNaN(wake)  ? new Date(wake).getHours()  + new Date(wake).getMinutes()/60  : NaN;

    return {
      date,
      sleepOnset: onset,
      wakeTime: wake,
      totalSleepMin: total,
      latencyMin: isNaN(latency) ? undefined : latency,
      wasoMin: isNaN(waso) ? undefined : waso,
      efficiencyPct: r.efficiency_pct ?? r.efficiency ?? undefined,
      quality: r.quality ? Number(r.quality) : undefined,
      onsetHour,
      wakeHour,
    };
  }).filter(x => x.date);
}
