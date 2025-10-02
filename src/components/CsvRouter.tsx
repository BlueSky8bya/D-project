// src/components/CsvRouter.tsx

import { useMemo } from 'react';
import type { KeyHints } from '../utils/inferKeys';
import { normalizeRows } from '../utils/normalizeRows';
import { findMetaByFile } from '../constants/csvRegistry';

import SensorViewer from './SensorViewer';
import StepCountViewer from './StepCountViewer';
import EMAViewer from './EMAViewer';
import SleepDiaryViewer from './SleepDiaryViewer';

type Props = {
  fileName: string;
  rows: any[];
  /** response.csv 에서만 사용 */
  surveyBlocks?: any[];
};

/** 공용 라우터: 파일명 → 적절한 Viewer로 라우팅 */
export default function CsvRouter({ fileName, rows, surveyBlocks = [] }: Props) {
  const meta = findMetaByFile(fileName);
  const hints: KeyHints = useMemo(
    () => ({
      timeKeyHint: meta?.timeKeyHint,
      valueKeysHint: meta?.valueKeysHint,
    }),
    [meta]
  );

  // 디버깅 로그: CsvRouter 진입점
  console.log(`[CsvRouter] 파일명: ${fileName}, 행 개수: ${rows.length}`, { meta, surveyBlocksLength: surveyBlocks.length });


  // ------------------------------------------
  // EMA / 수면일지 / 걸음수 → 전용 Viewer
  if (meta?.id === 'ema') {
    return <EMAViewer rows={rows} />;
  }
  if (meta?.id === 'sleep_diary') {
    return <SleepDiaryViewer rows={rows} />;
  }
  if (meta?.id === 'step_count') {
    return <StepCountViewer rows={rows} />;
  }

  // ------------------------------------------
  // 나머지 센서류 → SensorViewer (단일 컴포넌트)
  if (meta && (meta.kind === 'motion_sensor' || meta.kind === 'bio_sensor' || meta.kind === 'other_sensor')) {
    // normalize → 디버그 로그
    const norm = useMemo(() => normalizeRows(rows, meta), [rows, meta]);
    if (!norm) {
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          컬럼을 추론하지 못했습니다. CSV 헤더를 확인해주세요.
        </div>
      );
    }

    // 디버깅 출력 (개발자도구 콘솔에서 확인)
    try {
      const groupTitle = `[normalize] ${fileName} → ${meta.id} (${meta.kind})`;
      console.groupCollapsed(groupTitle);
      console.log('shape:', norm.shape);
      console.log('used mapping:', (norm as any).mapping, ' (hints: ', hints, ')');
      console.table(norm.coverage);
      console.log('sample rows:', (norm as any).rows.slice(0, 3));
      console.groupEnd();
    } catch (e) {
      console.warn("디버그 로그 출력 중 오류:", e);
    }

    return <SensorViewer fileName={fileName} normalized={norm!} />;
  }

  // ------------------------------------------
  // 알 수 없는 타입
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      이 파일은 아직 라우팅 규칙이 없습니다: {fileName}
    </div>
  );
}