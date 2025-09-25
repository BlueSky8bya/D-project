// src/constants/csvRegistry.ts

export type CsvKind =
  | 'motion_sensor' // 가속도/중력/자이로/걸음수
  | 'bio_sensor'    // 심박수/PpgGreen
  | 'other_sensor'  // 조도
  | 'survey'        // 설문/EMA
  | 'diary';        // 수면일지

export type FileMeta = {
  /** 실제 파일명 */
  file: string;
  /** 내부 id (차트/설정 키) */
  id:
    | 'accel'
    | 'gravity'
    | 'gyro'
    | 'step_count'
    | 'hr'
    | 'ppg'
    | 'light'
    | 'survey'
    | 'sleep_diary'
    | 'ema';
  /** 표시용 이름 */
  title: string;
  kind: CsvKind;
  /** inferKeys 힌트 */
  timeKeyHint?: string;
  valueKeysHint?: string[];
};

/** 대상 CSV 메타(파일 → 의미) */
export const CSV_META: FileMeta[] = [
  // -------- 센서 (SensorViewer로 통일)
  {
    file: 'watch_accelerometer.csv',
    id: 'accel',
    title: '가속도센서',
    kind: 'motion_sensor',
    timeKeyHint: 'timestamp',
    valueKeysHint: ['x', 'y', 'z'],
  },
  {
    file: 'watch_gravity.csv',
    id: 'gravity',
    title: '중력가속도센서',
    kind: 'motion_sensor',
    timeKeyHint: 'time',
    valueKeysHint: ['x', 'y', 'z', 'X', 'Y', 'Z'],
  },
  {
    file: 'watch_gyroscope.csv',
    id: 'gyro',
    title: '자이로센서',
    kind: 'motion_sensor',
    timeKeyHint: 'time',
    valueKeysHint: ['x', 'y', 'z', 'X', 'Y', 'Z'],
  },
  {
    file: 'watch_heart_rate.csv',
    id: 'hr',
    title: '심박수',
    kind: 'bio_sensor',
    timeKeyHint: 'timestamp',
    valueKeysHint: ['value', 'data'],
  },
  {
    file: 'watch_ppg_green.csv',
    id: 'ppg',
    title: 'PPG(녹색)',
    kind: 'bio_sensor',
    timeKeyHint: 'timestamp',
    valueKeysHint: ['value', 'data'],
  },
  {
    file: 'watch_light.csv',
    id: 'light',
    title: '조도센서',
    kind: 'other_sensor',
    timeKeyHint: 'timestamp',
    valueKeysHint: ['value', 'data'],
  },

  // -------- 설문/일지 (전용 뷰어 유지)
  { file: 'response.csv', id: 'survey', title: '설문 응답', kind: 'survey' },
  {
    file: 'sleep_diary.csv',
    id: 'sleep_diary',
    title: '수면일지',
    kind: 'diary',
    timeKeyHint: 'date',
  },
  {
    file: 'ema.csv',
    id: 'ema',
    title: 'EMA',
    kind: 'survey',
    timeKeyHint: 'date',
  },
  {
    file: 'watch_step_count.csv',
    id: 'step_count',
    title: '걸음수',
    kind: 'motion_sensor',
    timeKeyHint: 'timestamp',
    valueKeysHint: ['value', 'data'],
  },
] as const;

/** App에서 스캔 대상으로 쓰는 파일 리스트 */
export const TARGET_FILES = CSV_META.map((m) => m.file);

/** 파일명 → 메타 찾기 */
export function findMetaByFile(fileName: string) {
  const lower = fileName.toLowerCase();
  return CSV_META.find((m) => m.file.toLowerCase() === lower);
}

/** 표시용 이름 */
export function prettyName(baseOrFile: string) {
  const base = baseOrFile.replace(/\.csv$/i, '');
  const found =
    CSV_META.find((m) => m.file.replace(/\.csv$/i, '') === base) ??
    CSV_META.find((m) => m.file === `${base}.csv`);
  return found?.title ?? base;
}

/* -------------------------------------------------------
   센서별 시각화 옵션(파일을 늘리지 않고 여기서만 관리)
------------------------------------------------------- */
export type SensorConfig = {
  unit?: string;                 // Y축 단위 표기
  yDomain?: [number, number];    // Y축 범위 고정
  logScale?: boolean;            // Y축 로그 스케일 시도
  decimals?: number;             // 툴팁 소수
  showNorm?: boolean;            // triad: √(x²+y²+z²) 표시
  downsample?: number;           // 촘촘한 시계열에서 샘플링 간격
  smooth?: boolean;              // 선형 보간(monotone)
};

export const SENSOR_CONFIG: Record<FileMeta['id'], SensorConfig> = {
  accel:      { unit: 'm/s²', showNorm: true, decimals: 3 },
  gravity:    { unit: 'm/s²', showNorm: true, decimals: 3 },
  gyro:       { unit: 'rad/s', decimals: 3 },
  hr:         { unit: 'bpm', yDomain: [40, 200], smooth: true },
  ppg:        { unit: 'adc', downsample: 5 },
  light:      { unit: 'lux~', logScale: true },
  step_count: { unit: 'steps' },
  survey:     {},
  sleep_diary:{},
  ema:        {},
};