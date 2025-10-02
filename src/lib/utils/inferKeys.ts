// src/lib/utils/inferKeys.ts

export type Shape = 'mono' | 'triad';

export type KeyHints = {
  timeKeyHint?: string;
  valueKeysHint?: string[]; // mono일 때 우선순위
  xKey?: string;
  yKey?: string;
  zKey?: string;
};

export type MonoMapping = { shape: 'mono'; timeKey: string; valKey: string; };
export type TriadMapping = { shape: 'triad'; timeKey: string; xKey: string; yKey: string; zKey: string; };
export type InferredMapping = MonoMapping | TriadMapping;

const TIME_CANDIDATES = ['timestamp', 'time', 'date', 'datetime', 'createdAt'];
const MONO_VAL_CANDIDATES = ['value', 'data'];
const TRIAD_VAL_CANDIDATES = ['x', 'y', 'z', 'X', 'Y', 'Z'];

/** 가장 먼저 매칭되는 키 반환 */
function pickFirst(keys: string[], candidates: string[]) {
  for (const c of candidates) if (keys.includes(c)) return c;
  return undefined;
}

/** 힌트 + 관찰치 기반 키 추론 */
export function inferKeys(rows: any[], hints: KeyHints = {}): InferredMapping | null {
  if (!rows?.length) return null;
  const sample = rows.find(Boolean) ?? rows[0];
  const keys = Object.keys(sample);

  // time key
  const timeKey =
    hints.timeKeyHint && keys.includes(hints.timeKeyHint)
      ? hints.timeKeyHint
      : pickFirst(keys, TIME_CANDIDATES);
  if (!timeKey) return null;

  // triad 판단
  const xyzCandidates = TRIAD_VAL_CANDIDATES.filter((k) => keys.includes(k));
  const hasTriadLower = ['x', 'y', 'z'].every((k) => keys.includes(k));
  const hasTriadUpper = ['X', 'Y', 'Z'].every((k) => keys.includes(k));

  if (hints.xKey && hints.yKey && hints.zKey) {
    if ([hints.xKey, hints.yKey, hints.zKey].every((k) => keys.includes(k))) {
      return { shape: 'triad', timeKey, xKey: hints.xKey, yKey: hints.yKey, zKey: hints.zKey };
    }
  }

  if (hasTriadLower || hasTriadUpper) {
    const xKey = hasTriadLower ? 'x' : 'X';
    const yKey = hasTriadLower ? 'y' : 'Y';
    const zKey = hasTriadLower ? 'z' : 'Z';
    return { shape: 'triad', timeKey, xKey, yKey, zKey };
  }

  if (xyzCandidates.length >= 3) {
    const xKey = xyzCandidates.find((k) => k.toLowerCase() === 'x')!;
    const yKey = xyzCandidates.find((k) => k.toLowerCase() === 'y')!;
    const zKey = xyzCandidates.find((k) => k.toLowerCase() === 'z')!;
    if (xKey && yKey && zKey) return { shape: 'triad', timeKey, xKey, yKey, zKey };
  }

  // mono
  const monoPref = hints.valueKeysHint?.length ? hints.valueKeysHint : MONO_VAL_CANDIDATES;
  const valKey = pickFirst(keys, monoPref);
  if (!valKey) return null;

  return { shape: 'mono', timeKey, valKey };
}
