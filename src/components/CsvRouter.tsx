// src/components/CsvRouter.tsx - 데이터 종류에 따라 적절한 뷰어를 연결하는 라우터

import { useMemo } from 'react';
import type { KeyHints } from '../lib/utils/inferKeys';
import { normalizeRows } from '../lib/utils/normalizeRows';
import { findMetaByFile } from '../constants/csvRegistry';

import StepCountViewer from '../features/StepCount/StepCountViewer';
import EMAViewer from '../features/EMA/EMAViewer';
import SleepDiaryViewer from '../features/SleepDiary/SleepDiaryViewer';

import AccelerometerViewer from '../features/Accelerometer/AccelerometerViewer';
import GravityViewer from '../features/Gravity/GravityViewer';
import GyroscopeViewer from '../features/Gyroscope/GyroscopeViewer';
import HeartRateViewer from '../features/HeartRate/HeartRateViewer';
import PpgGreenViewer from '../features/PpgGreen/PpgGreenViewer';
import LightViewer from '../features/Light/LightViewer';

import SurveyResultsViewer from '../features/Response/ResponseViewer'; // response.csv용

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
  console.log(
    `[CsvRouter] 파일명: ${fileName}, 행 개수: ${rows.length}`,
    { meta, surveyBlocksLength: surveyBlocks.length }
  );

  // 센서 여부 판별 (훅은 조건부로 호출하면 안 되므로, isSensor를 deps에 포함해 조건 처리)
  const isSensor =
    !!meta &&
    (meta.kind === 'motion_sensor' ||
      meta.kind === 'bio_sensor' ||
      meta.kind === 'other_sensor');

  // 센서류일 때만 정규화 계산, 아니면 null 반환
  const norm = useMemo(() => {
    if (!isSensor) return null;
    const n = normalizeRows(rows, hints);
    try {
      if (n) {
        const groupTitle = `[normalize] ${fileName} → ${meta?.id} (${meta?.kind})`;
        console.groupCollapsed(groupTitle);
        console.log('shape:', n.shape);
        console.log('used mapping:', (n as any).mapping, ' (hints: ', hints, ')');
        console.table(n.coverage);
        console.log('sample rows:', (n as any).rows.slice(0, 3));
        console.groupEnd();
      }
    } catch (e) {
      console.warn('디버그 로그 출력 중 오류:', e);
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, hints, isSensor, fileName, meta?.id, meta?.kind]);

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
  if (meta?.id === 'survey') {
    return <SurveyResultsViewer surveyBlocks={surveyBlocks} />;
  }

  // ------------------------------------------
  // 센서류 → 센서별 전용 Viewer로 분기
  if (isSensor) {
    if (!norm) {
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          컬럼을 추론하지 못했습니다. CSV 헤더를 확인해주세요.
        </div>
      );
    }

    switch (meta!.id) {
      case 'accel':
        return <AccelerometerViewer fileName={fileName} normalized={norm} />;
      case 'gravity':
        return <GravityViewer fileName={fileName} normalized={norm} />;
      case 'gyro':
        return <GyroscopeViewer fileName={fileName} normalized={norm} />;
      case 'hr':
        return <HeartRateViewer fileName={fileName} normalized={norm} />;
      case 'ppg':
        return <PpgGreenViewer fileName={fileName} normalized={norm} />;
      case 'light':
        return <LightViewer fileName={fileName} normalized={norm} />;
      default:
        return (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            아직 전용 뷰어가 없습니다: {meta!.id}
          </div>
        );
    }
  }

  // ------------------------------------------
  // 알 수 없는 타입
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      이 파일은 아직 라우팅 규칙이 없습니다: {fileName}
    </div>
  );
}
