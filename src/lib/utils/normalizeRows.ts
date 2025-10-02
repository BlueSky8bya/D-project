// src/lib/utils/normalizeRows.ts

import type { InferredMapping, KeyHints } from './inferKeys';
import { inferKeys } from './inferKeys';

export type NormalizedMono  = { ts: number | null; value: number | null };
export type NormalizedTriad = { ts: number | null; x: number | null; y: number | null; z: number | null };

export type NormalizeResult =
  | { shape: 'mono';  rows: NormalizedMono[];  mapping: Extract<InferredMapping, {shape:'mono'}>;  coverage: { column: string; coverage: string }[] }
  | { shape: 'triad'; rows: NormalizedTriad[]; mapping: Extract<InferredMapping, {shape:'triad'}>; coverage: { column: string; coverage: string }[] };

function percent(n: number, d: number) {
  const p = d ? Math.round((n / d) * 10000) / 100 : 0;
  return `${n}/${d} (${p.toFixed(2)}%)`;
}

// 문자열/날짜/숫자 → epoch(ms) 또는 null
function toEpoch(v: any): number | null {
  try {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    }
    return null;
  } catch (e) {
    console.error("toEpoch 변환 실패:", v, e);
    return null;
  }
}

export function normalizeRows(raw: any[], hints: KeyHints = {}): NormalizeResult | null {
  console.log('normalizeRows 시작:', { rawCount: raw.length, hints });
  const m = inferKeys(raw, hints);
  if (!m) {
    console.error("키 추론 실패(inferKeys).", { hints });
    return null;
  }

  const N = raw.length;

  if (m.shape === 'mono') {
    let nOkTs = 0, nOkVal = 0;
    const rows = raw.map((r) => {
      const ts = toEpoch(r[m.timeKey]); if (ts != null) nOkTs++;
      const val = Number(r[m.valKey]);  if (Number.isFinite(val)) nOkVal++;
      return { ts, value: Number.isFinite(val) ? val : null };
    });
    const coverage = [
      { column: 'ts',    coverage: percent(nOkTs, N) },
      { column: 'value', coverage: percent(nOkVal, N) },
    ];
    console.log('Mono 데이터 정규화 완료:', { mapping: m, coverage });
    return { shape: 'mono', rows, mapping: m, coverage };
  }

  // triad
  let tsOk=0, xOk=0, yOk=0, zOk=0;
  const rows = raw.map((r) => {
    const ts = toEpoch(r[m.timeKey]); if (ts != null) tsOk++;
    const x  = Number(r[m.xKey]);     if (Number.isFinite(x)) xOk++;
    const y  = Number(r[m.yKey]);     if (Number.isFinite(y)) yOk++;
    const z  = Number(r[m.zKey]);     if (Number.isFinite(z)) zOk++;
    return {
      ts,
      x: Number.isFinite(x) ? x : null,
      y: Number.isFinite(y) ? y : null,
      z: Number.isFinite(z) ? z : null,
    };
  });
  const coverage = [
    { column: 'ts', coverage: percent(tsOk, N) },
    { column: 'x',  coverage: percent(xOk, N) },
    { column: 'y',  coverage: percent(yOk, N) },
    { column: 'z',  coverage: percent(zOk, N) },
  ];
  console.log('Triad 데이터 정규화 완료:', { mapping: m, coverage });
  return { shape: 'triad', rows, mapping: m, coverage };
}