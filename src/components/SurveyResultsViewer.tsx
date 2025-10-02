// src/components/SurveyResultsViewer.tsx

import React, { useEffect, useMemo, useState, useId } from 'react';
import { Info, TrendingUp, Calendar, BarChart3, Download, FileDown } from 'lucide-react';
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import type { SurveyBlock } from '../utils/parseSurveyResponses';
import { analyzeSurveyBlock, type AnalysisResult } from '../utils/surveyAnalysis';
import { exportToCsv } from '../utils/exportSurvey';

type Props = {
  surveyBlocks: SurveyBlock[];
};

// 커스텀 툴팁에 들어오는 payload 최소 정의
type CatTooltipPayload = {
  value?: number | string;
  payload?: TrendPoint; // 우리가 만든 TrendPoint 타입을 그대로 활용
};

type CatTooltipProps = {
  active?: boolean;
  payload?: CatTooltipPayload[];
  label?: string | number;
};

/* =========================
   Meta & Colors
========================= */
const SURVEY_META: Record<string, { desc: string; invert?: boolean; isContinuousHint?: boolean }> = {
  'PHQ-9': { desc: '우울증 건강설문 (9문항)' },
  'CES-D': { desc: '역학연구용 우울척도' },
  'GAD-7': { desc: '일반화된 불안장애 척도' },
  'ISI': { desc: '불면증 심각도 척도' },
  'Stress-20': { desc: '스트레스 척도 (20문항)', isContinuousHint: true },
  'Stress Questionnaire': { desc: '스트레스 척도 (20문항)', isContinuousHint: true },
  'INQ': { desc: '대인관계 욕구 척도', isContinuousHint: true },
  'WHOQOL-BREF': { desc: '세계보건기구 삶의 질 척도', invert: true, isContinuousHint: true },
  'S-Scale-A': { desc: '스마트폰중독 측정척도' },
  'HAM-A': { desc: '해밀턴 불안 척도' },
  'HAM-D': { desc: '해밀턴 우울 척도' },
  'CNS-VS': { desc: '인지기능 평가' },
};

const CAT_HEX: Record<number, string[]> = {
  2: ['#10b981', '#ef4444'],
  3: ['#10b981', '#eab308', '#ef4444'],
  4: ['#10b981', '#eab308', '#f97316', '#ef4444'],
  5: ['#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444'],
};
const pickCatHex = (count: number, idx: number) =>
  (CAT_HEX[count] ?? ['#6b7280'])[
    Math.max(0, Math.min((CAT_HEX[count]?.length ?? 1) - 1, idx))
  ];

const SERIES_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']; // 연속형 다중 라인
const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '');

/* =========================
   UI: Continuous bar
========================= */
const ContinuousBar: React.FC<{ scale: any; reverseColor?: boolean }> = ({
  scale,
  reverseColor = false,
}) => {
  if (
    scale.min === undefined ||
    scale.max === undefined ||
    typeof scale.score !== 'number'
  )
    return null;
  const percentage =
    scale.max > scale.min
      ? ((scale.score - scale.min) / (scale.max - scale.min)) * 100
      : 0;

  const gradientClass = reverseColor
    ? 'bg-gradient-to-r from-red-500 to-green-400'
    : 'bg-gradient-to-r from-green-400 to-red-500';

  return (
    <div className="text-sm">
      <div className="flex justify-between items-center mb-1">
        <span className="text-stone-600">{scale.name}</span>
        <span className="font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded">
          {scale.score} / {scale.max}
        </span>
      </div>
      <div className="w-full bg-stone-200 rounded-full h-2.5 relative">
        <div className={`${gradientClass} h-2.5 rounded-full`} />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full border-2 border-stone-600"
          style={{ left: `${Math.max(0, Math.min(100, percentage))}%` }}
        />
      </div>
    </div>
  );
};

/* =========================
   UI: Categorical list
========================= */
const CategoricalDisplay: React.FC<{ categories: any[]; name: string }> = ({
  categories = [],
  name,
}) => {
  const getColors = (count: number, index: number) => {
    const scales: {
      [key: number]: { textBg: string; border: string; ring: string }[];
    } = {
      2: [
        {
          textBg: 'text-green-800 bg-green-100',
          border: 'border-green-500',
          ring: 'ring-green-300',
        },
        {
          textBg: 'text-red-800 bg-red-100',
          border: 'border-red-500',
          ring: 'ring-red-300',
        },
      ],
      3: [
        {
          textBg: 'text-green-800 bg-green-100',
          border: 'border-green-500',
          ring: 'ring-green-300',
        },
        {
          textBg: 'text-yellow-800 bg-yellow-100',
          border: 'border-yellow-500',
          ring: 'ring-yellow-300',
        },
        {
          textBg: 'text-red-800 bg-red-100',
          border: 'border-red-500',
          ring: 'ring-red-300',
        },
      ],
      4: [
        {
          textBg: 'text-green-800 bg-green-100',
          border: 'border-green-500',
          ring: 'ring-green-300',
        },
        {
          textBg: 'text-yellow-800 bg-yellow-100',
          border: 'border-yellow-500',
          ring: 'ring-yellow-300',
        },
        {
          textBg: 'text-orange-800 bg-orange-100',
          border: 'border-orange-500',
          ring: 'ring-orange-300',
        },
        {
          textBg: 'text-red-800 bg-red-100',
          border: 'border-red-500',
          ring: 'ring-red-300',
        },
      ],
      5: [
        {
          textBg: 'text-green-800 bg-green-100',
          border: 'border-green-500',
          ring: 'ring-green-300',
        },
        {
          textBg: 'text-lime-800 bg-lime-100',
          border: 'border-lime-500',
          ring: 'ring-lime-300',
        },
        {
          textBg: 'text-yellow-800 bg-yellow-100',
          border: 'border-yellow-500',
          ring: 'ring-yellow-300',
        },
        {
          textBg: 'text-orange-800 bg-orange-100',
          border: 'border-orange-500',
          ring: 'ring-orange-300',
        },
        {
          textBg: 'text-red-800 bg-red-100',
          border: 'border-red-500',
          ring: 'ring-red-300',
        },
      ],
    };
    return (
      scales[count] || [
        {
          textBg: 'text-stone-800 bg-stone-100',
          border: 'border-stone-500',
          ring: 'ring-stone-300',
        },
      ]
    )[index];
  };

  return (
    <div className="mt-4 grid grid-cols-1 gap-1">
      {categories.map((cat, index) => {
        const colors = getColors(categories.length, index);
        const isCurrent = !!cat.isCurrent;

        const boxClass = isCurrent
          ? `border-2 ${colors.border} ${colors.ring} ring-2 font-bold shadow-sm scale-[1.02] p-2.5`
          : 'border border-stone-200 p-2';

        const textSize = isCurrent ? 'text-sm' : 'text-xs';

        return (
          <div
            key={cat.name}
            className={`rounded-md flex justify-between items-center transition-all duration-200 ${colors.textBg} ${boxClass}`}
          >
            <span className={textSize}>{cat.name}</span>
            {name !== 'S-Scale-A' && (
              <span className={`font-mono opacity-75 whitespace-nowrap ${textSize}`}>
                {cat.scoreRange}점
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* =========================
   Trend chart (categorical / continuous)
========================= */
type TrendPoint = {
  week: string;
  score: number;
  _catIdx?: number;
  _catName?: string;
  _color?: string;
};

type TrendMode =
  | { kind: 'categorical'; data: TrendPoint[] }
  | { kind: 'continuous'; data: Array<Record<string, any>>; series: string[] };

const CatTooltip: React.FC<CatTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const color = p.payload?._color ?? '#10b981';
  const catName = p.payload?._catName ?? '';
  const value = p.value;

  return (
    <div className="rounded-lg border border-stone-200 bg-white/95 shadow-md px-3 py-2 text-sm">
      <div className="font-medium text-stone-800">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-stone-600">score :</span>
        <span className="font-semibold text-stone-800">{value}</span>
      </div>
      {catName && (
        <div className="text-xs font-medium mt-1" style={{ color }}>
          {catName} {/* 예: 우울 아님 / 심한 증상 */}
        </div>
      )}
    </div>
  );
};

const TrendChart: React.FC<{
  mode: TrendMode;
  surveyName: string;
  yDomain?: [number, number];
  invertGradient?: boolean;
  subScaleRanges?: Record<string, { min?: number; max?: number }>;
}> = ({ mode, surveyName, yDomain, invertGradient = false , subScaleRanges = {} }) => {
  const uid = useId();
  const meta = SURVEY_META[surveyName];
  const titleDesc = meta?.desc ? ` · ${meta.desc}` : '';
  const gradId = `yGrad-${safeId(surveyName)}-${uid}`;
  const lineGradId = `lineGrad-${safeId(surveyName)}-${uid}`;

  const hasData =
    (mode.kind === 'categorical' && mode.data.length > 0) ||
    (mode.kind === 'continuous' &&
      mode.data.length > 0 &&
      mode.series.some((s) =>
        mode.data.some((d) => Number.isFinite(d[s] as number)),
      ));

  const lineStops = mode.kind === 'categorical' && mode.data.length > 0
    ? mode.data.map((d, i) => ({
        offset: `${(i / Math.max(1, mode.data.length - 1)) * 100}%`,
        color: d._color || '#10b981',
      }))
    : [];

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-stone-800">
            주차별 점수 변화 추이 · {surveyName}
            <span className="text-stone-500 text-sm ml-1">{titleDesc}</span>
          </h3>
        </div>
        <p className="text-stone-500 text-sm">표시할 유효한 점수가 없습니다.</p>
      </div>
    );
  }

  // 데이터 1건(분류형) → 요약 카드
  if (mode.kind === 'categorical' && mode.data.length === 1) {
    const d = mode.data[0];
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-stone-800">
            주차별 점수 변화 추이 · {surveyName}
            <span className="text-stone-500 text-sm ml-1">{titleDesc}</span>
          </h3>
        </div>
        <div className="flex flex-col items-center py-10">
          <div className="text-3xl font-bold text-stone-900">{d.score}점</div>
          <div className="text-sm text-stone-500 mt-1">{d.week}</div>
          {d._catName && (
            <span
              className="mt-3 px-2 py-1 text-xs rounded-full text-white"
              style={{ backgroundColor: d._color || '#10b981' }}
            >
              {d._catName}
            </span>
          )}
          <p className="text-xs text-stone-500 mt-4">
            데이터가 1건이라 추이선을 표시하지 않았습니다.
          </p>
        </div>
      </div>
    );
  }

  // 데이터 1건(연속형) → 하위척도 카드형 요약
  if (mode.kind === 'continuous' && mode.data.length === 1) {
    const row = mode.data[0] as Record<string, any>;
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-stone-800">
            주차별 점수 변화 추이 · {surveyName}
            <span className="text-stone-500 text-sm ml-1">{titleDesc}</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6">
          {(mode.series as string[]).map((name) => {
            const v = row[name];
            if (!Number.isFinite(v)) return null;
            const range = subScaleRanges[name] || {};
            return (
              <ContinuousBar
                key={name}
                scale={{ name, score: v, min: range.min ?? 0, max: range.max ?? Math.max(10, v) }}
                reverseColor={surveyName === 'WHOQOL-BREF'}
              />
            );
          })}
        </div>

        <p className="text-xs text-stone-500 mt-2">
          데이터가 1건이라 추이선을 표시하지 않았습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-emerald-600" />
        <h3 className="text-lg font-semibold text-stone-800">
          주차별 점수 변화 추이 · {surveyName}
          <span className="text-stone-500 text-sm ml-1">{titleDesc}</span>
        </h3>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <LineChart
          data={mode.kind === 'categorical' ? mode.data : (mode as any).data}
          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
        >
          {/* Y축 배경 그라데이션 (WHOQOL-BREF 반전) */}
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={invertGradient ? '#10b981' : '#ef4444'}
                stopOpacity={0.22}
              />
              <stop
                offset="100%"
                stopColor={invertGradient ? '#ef4444' : '#10b981'}
                stopOpacity={0.18}
              />
            </linearGradient>
            {mode.kind === 'categorical' && lineStops.length > 0 && (
              <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
                {lineStops.map(s => (
                  <stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={1} />
                ))}
              </linearGradient>
            )}
          </defs>
          {yDomain && (
            <ReferenceArea
              y1={yDomain[0]}
              y2={yDomain[1]}
              fill={`url(#${gradId})`}
              strokeOpacity={0}
            />
          )}

          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="week"
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
            label={{ value: 'Week', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            stroke="#6b7280"
            domain={yDomain ?? ['auto', 'auto']}
            tick={{ fontSize: 12 }}
            label={{ value: '점수', angle: -90, position: 'insideLeft' }}
          />

          {/* Tooltip: 분류형은 커스텀, 연속형은 기본 */}
          {mode.kind === 'categorical' ? (
            <Tooltip content={<CatTooltip />} />
          ) : (
            <Tooltip
              contentStyle={{
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
          )}

          {mode.kind === 'categorical' ? (() => {
            // 동일 색/동일 값 → 그라디언트 대신 단색 + 직선
            const uniformColor = new Set(mode.data.map(d => d._color)).size <= 1;
            const uniformScore = new Set(mode.data.map(d => d.score)).size <= 1;
            const strokeValue = (uniformColor || uniformScore)
              ? (mode.data[0]._color || '#10b981')
              : `url(#${lineGradId})`;
            const lineType = (mode.data.length <= 2 || uniformScore) ? 'linear' : 'monotone';

            return (
              <Line
                type={lineType}
                dataKey="score"
                stroke={strokeValue}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                isAnimationActive={true}
                animationDuration={700}
                animationEasing="ease-in-out"
                connectNulls
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  const fill = payload._color || '#10b981';
                  return (
                    <motion.circle
                      key={`dot-${payload.week}`}
                      initial={false}
                      animate={{ cx, cy, opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: index * 0.03 }}
                      cx={cx} cy={cy} r={5} fill={fill} stroke="#ffffff" strokeWidth={2}
                    />
                  );
                }}
                activeDot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const fill = payload._color || '#10b981';
                  return (
                    <motion.circle
                      key={`active-${payload.week}`}
                      initial={false}
                      animate={{ cx, cy, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                      cx={cx} cy={cy} r={7} fill={fill} stroke="#111827" strokeWidth={1.5}
                    />
                  );
                }}
              />
            );
          })()
            : (
              // 연속형: 시리즈 값이 전부 같거나 포인트 2개 이하면 직선
              (mode.series as string[])
                .filter((s) => (mode as any).data.some((d: any) => Number.isFinite(d[s])))
                .map((s, i) => {
                  const seriesVals = (mode as any).data
                    .map((d: any) => (typeof d[s] === 'number' && Number.isFinite(d[s]) ? d[s] : null))
                    .filter((v: number | null) => v !== null) as number[];
                  const uniformSeries = seriesVals.length >= 2 && seriesVals.every(v => v === seriesVals[0]);
                  const lineType = (seriesVals.length <= 2 || uniformSeries) ? 'linear' : 'monotone';

                  return (
                    <Line
                      key={s}
                      type={lineType}
                      dataKey={s}
                      name={s}
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      strokeWidth={3}
                      isAnimationActive={true}
                      animationDuration={700}
                      animationEasing="ease-in-out"
                      connectNulls
                      dot={(props: any) => {
                        const { cx, cy } = props;
                        const fill = props.stroke;
                        return (
                          <motion.circle
                            key={`dot-${s}-${cx}-${cy}`}
                            initial={false}
                            animate={{ cx, cy, opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                            cx={cx} cy={cy} r={3} fill={fill} stroke="#ffffff" strokeWidth={1.5}
                          />
                        );
                      }}
                      activeDot={(props: any) => {
                        const { cx, cy } = props;
                        const fill = props.stroke;
                        return (
                          <motion.circle
                            key={`active-${s}-${cx}-${cy}`}
                            initial={false}
                            animate={{ cx, cy, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                            cx={cx} cy={cy} r={5} fill={fill} stroke="#111827" strokeWidth={2}
                          />
                        );
                      }}
                    />
                  );
                })
            )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/* =========================
   Result Card
========================= */
const ResultCard: React.FC<{ result: AnalysisResult }> = ({ result }) => {
  const getCurrentScoreColor = () => {
    if (!result.categories) return 'text-emerald-600';
    const currentIndex = result.categories.findIndex((c) => c.isCurrent);
    if (currentIndex === -1) return 'text-emerald-600';
    const colorMap: { [key: number]: string[] } = {
      2: ['text-green-600', 'text-red-600'],
      3: ['text-green-600', 'text-yellow-600', 'text-red-600'],
      4: ['text-green-600', 'text-yellow-600', 'text-orange-600', 'text-red-600'],
      5: [
        'text-green-600',
        'text-lime-600',
        'text-yellow-600',
        'text-orange-600',
        'text-red-600',
      ],
    };
    return (colorMap[result.categories.length] || ['text-emerald-600'])[
      currentIndex
    ];
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full">
      <div>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="font-bold text-stone-900 text-lg">{result.name}</h4>
            <p className="text-sm text-stone-500 mt-1">{result.description}</p>
          </div>
          {!result.categories && (
            <div className="relative group">
              <Info className="w-5 h-5 text-stone-400 hover:text-stone-600 transition-colors" />
              <div className="absolute bottom-full right-0 mb-2 w-48 p-3 text-xs text-white bg-stone-800 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                {result.interpretation}
              </div>
            </div>
          )}
        </div>

        {/* 점수 영역 */}
        <div className="flex items-center gap-3 mb-4">
          {result.totalScore !== undefined && (
            <p
              className={`text-3xl font-bold whitespace-nowrap ${getCurrentScoreColor()}`}
            >
              {result.totalScore}점
            </p>
          )}
        </div>
      </div>

      <div className="flex-1">
        {result.categories && (
          <CategoricalDisplay categories={result.categories} name={result.name} />
        )}

        {result.subScales?.some((s) => s.min !== undefined) && (
          <div className="mt-4 border-t border-stone-200 pt-4 space-y-3">
            {result.subScales?.map((scale) => (
              <ContinuousBar
                key={scale.name}
                scale={scale}
                reverseColor={result.name === 'WHOQOL-BREF'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================
   Main Viewer
========================= */
export default function SurveyResultsViewer({ surveyBlocks }: Props) {
  const [chartKey, setChartKey] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'trend'>('cards');
  const [selectedSurveyForTrend, setSelectedSurveyForTrend] =
    useState<string | null>(null);

  const blocks = surveyBlocks;

  const groupedByWeek = useMemo(() => {
    return blocks.reduce((acc, block) => {
      const week = String(block.week ?? 'N/A');
      if (!acc[week]) acc[week] = [];
      acc[week].push(block);
      return acc;
    }, {} as Record<string, SurveyBlock[]>);
  }, [blocks]);

  const weeks = useMemo(() => {
    const w = Object.keys(groupedByWeek).sort((a, b) => {
      if (a === 'N/A') return 1;
      if (b === 'N/A') return -1;
      return Number(a) - Number(b);
    });
    return w;
  }, [groupedByWeek]);

  const hasMultipleWeeks = weeks.length > 1;

  const surveyNames = useMemo(
    () => [...new Set(blocks.map((block) => block.name))],
    [blocks],
  );

  // 초기 선택
  useEffect(() => {
    if (selectedWeek === null && weeks.length > 0)
      setSelectedWeek(weeks[0]); // 0주차부터
  }, [selectedWeek, weeks]);
  useEffect(() => {
    if (selectedSurveyForTrend === null && surveyNames.length > 0)
      setSelectedSurveyForTrend(surveyNames[0]);
  }, [selectedSurveyForTrend, surveyNames]);

  // 샘플 블록/결과
  const sampleBlock = useMemo(() => {
    for (const w of weeks) {
      const blk = (groupedByWeek[w] || []).find(
        (b) => b.name === (selectedSurveyForTrend ?? ''),
      );
      if (blk) return blk;
    }
    return null;
  }, [groupedByWeek, weeks, selectedSurveyForTrend]);

  const sampleResult = useMemo(
    () => (sampleBlock ? analyzeSurveyBlock(sampleBlock) : undefined),
    [sampleBlock],
  );

  // 연속형 여부(서브스케일 존재 또는 힌트)
  const isContinuousSelected = useMemo(() => {
    const hint = selectedSurveyForTrend
      ? SURVEY_META[selectedSurveyForTrend]?.isContinuousHint
      : false;
    const byResult = !!sampleResult?.subScales?.some((s) => s.min !== undefined);
    return hint || byResult;
  }, [selectedSurveyForTrend, sampleResult]);

  // 분류형 데이터 (각 주차 dot 색 = 카테고리 색)
  const categoricalTrendData: TrendPoint[] = useMemo(() => {
    if (!hasMultipleWeeks || !selectedSurveyForTrend || isContinuousSelected)
      return [];
    const data: TrendPoint[] = [];
    weeks.forEach((week) => {
      const block = (groupedByWeek[week] || []).find(
        (b) => b.name === selectedSurveyForTrend,
      );
      if (!block) return;
      const r = analyzeSurveyBlock(block);
      if (typeof r?.totalScore === 'number' && Number.isFinite(r.totalScore)) {
        const idx = r.categories ? r.categories.findIndex((c) => c.isCurrent) : -1;

        let name: string | undefined;
        let col = '#10b981';
        if (r.categories && idx >= 0) {
          name = r.categories[idx]?.name;
          col = pickCatHex(r.categories.length, idx);
        }

        data.push({
          week: `Week ${week}`,
          score: r.totalScore,
          _catIdx: idx,
          _catName: name,
          _color: col,
        });
      }
    });
    return data;
  }, [
    groupedByWeek,
    weeks,
    hasMultipleWeeks,
    selectedSurveyForTrend,
    isContinuousSelected,
  ]);

  // 연속형: 하위요소 시리즈
  const continuousSeriesNames = useMemo<string[]>(() => {
    if (!isContinuousSelected) return [];
    return (
      sampleResult?.subScales?.filter((s) => s.min !== undefined).map((s) => s.name) ??
      []
    );
  }, [isContinuousSelected, sampleResult]);

  // 하위척도 범위 맵 (연속형 단일 주차 카드 표시용)
  const continuousSeriesRanges = useMemo<Record<string, { min?: number; max?: number }>>(() => {
    const map: Record<string, { min?: number; max?: number }> = {};
    sampleResult?.subScales?.forEach((s) => {
      if (s.min !== undefined || s.max !== undefined) {
        map[s.name] = { min: s.min, max: s.max };
      }
    });
    return map;
  }, [sampleResult]);

  // 연속형 데이터 (모든 시리즈 null인 주차는 제외 → 빈 X축 제거)
  const continuousTrendData = useMemo<Array<Record<string, any>>>(() => {
    if (!hasMultipleWeeks || !selectedSurveyForTrend || !isContinuousSelected)
      return [];
    const rows: Record<string, any>[] = [];

    weeks.forEach((week) => {
      const row: Record<string, any> = { week: `Week ${week}` };
      const block = (groupedByWeek[week] || []).find(
        (b) => b.name === selectedSurveyForTrend,
      );
      if (!block) return;

      const r = analyzeSurveyBlock(block);
      let hasAny = false;
      continuousSeriesNames.forEach((name) => {
        const s = r?.subScales?.find((ss) => ss.name === name);
        const val =
          typeof s?.score === 'number' && Number.isFinite(s.score)
            ? s.score
            : null;
        if (val !== null) hasAny = true;
        row[name] = val; // null → 미표시
      });

      if (hasAny) rows.push(row);
    });

    return rows;
  }, [
    groupedByWeek,
    weeks,
    hasMultipleWeeks,
    selectedSurveyForTrend,
    isContinuousSelected,
    continuousSeriesNames,
  ]);

  // y축 도메인 (유효값 기준)
  const yDomainForSelected: [number, number] | undefined = useMemo(() => {
    if (isContinuousSelected) {
      const vals: number[] = [];
      continuousTrendData.forEach((d) => {
        continuousSeriesNames.forEach((n) => {
          const v = d[n];
          if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
        });
      });
      if (!vals.length) return undefined;
      const max = Math.max(...vals);
      // [수정] 연속형 데이터에도 10% 여유 공간 추가
      return [0, Math.max(10, Math.ceil(max * 1.1))];
    } else {
      if (!categoricalTrendData.length) return undefined;
      const max = Math.max(...categoricalTrendData.map((d) => d.score));
      // [수정] 분류형 데이터에도 10% 여유 공간 추가
      return [0, Math.max(10, Math.ceil(max * 1.1))];
    }
  }, [
    isContinuousSelected,
    continuousTrendData,
    continuousSeriesNames,
    categoricalTrendData,
  ]);

  useEffect(() => {
    setChartKey((k) => k + 1);
  }, [
    selectedSurveyForTrend,
    isContinuousSelected,
    viewMode,
    continuousSeriesNames.join('|'), 
    categoricalTrendData.length
  ]);

  const blocksToShow = selectedWeek ? groupedByWeek[selectedWeek] : [];

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <BarChart3 className="w-16 h-16 text-stone-300 mb-4" />
        <p className="text-stone-500 text-lg">표시할 설문 응답이 없습니다.</p>
      </div>
    );
  }

  /**
   * 설문 결과를 정책에 따라 CSV로 추출하는 핸들러 함수
   * @param policy - 'analysis' (분석 결과) 또는 'raw' (원본 데이터)
   */
  const handleExport = (policy: 'analysis' | 'raw') => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    const subjectId = "participant_data"; // 필요시 동적으로 설정
    const filename = `${subjectId}_survey_${policy}_${timestamp}.csv`;

    const rows: (string | number)[][] = [];

    if (policy === 'analysis') {
      const headers = ['Week', 'Survey Name', 'Total Score', 'Interpretation', 'Category', 'Sub-scale Name', 'Sub-scale Score'];
      rows.push(headers);

      weeks.forEach(week => {
        const blocksForWeek = groupedByWeek[week] || [];
        blocksForWeek.forEach(block => {
          const result = analyzeSurveyBlock(block);
          const baseRow: (string | number)[] = [
            `Week ${week}`,
            result.name,
            result.totalScore ?? 'N/A',
            result.interpretation ?? '',
          ];

          if (result.categories?.length) {
            const currentCategory = result.categories.find(c => c.isCurrent);
            rows.push([...baseRow, currentCategory?.name ?? '', '', '']);
          } else if (result.subScales?.length) {
            result.subScales.forEach(subScale => {
              rows.push([...baseRow, '', subScale.name, subScale.score]);
            });
          } else {
            rows.push([...baseRow, '', '', '']);
          }
        });
      });
    } else if (policy === 'raw') {
      const headers = ['Week', 'Survey Name', 'Question Index', 'Question Text', 'Selected Option Index', 'Selected Option Text'];
      rows.push(headers);

      weeks.forEach(week => {
        const blocksForWeek = groupedByWeek[week] || [];
        blocksForWeek.forEach(block => {
          block.items.forEach(item => {
            const selectedOptionText = (item.selectedIndex !== null && item.options[item.selectedIndex])
              ? item.options[item.selectedIndex]
              : 'N/A';
            const row: (string | number)[] = [
              `Week ${week}`,
              block.name,
              item.idx + 1,
              item.question,
              item.selectedIndex ?? 'N/A',
              selectedOptionText,
            ];
            rows.push(row);
          });
        });
      });
    }

    exportToCsv(filename, rows);
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-emerald-600" />
              설문 결과 분석
            </h2>
            <p className="text-stone-600 mt-1">
              {hasMultipleWeeks ? `총 ${weeks.length}주차 데이터` : '현재 주차 데이터'}
            </p>
          </div>

          {hasMultipleWeeks && (
            <div className="flex gap-2 bg-stone-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${viewMode === 'cards'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                  }`}
              >
                카드 보기
              </button>
              <button
                onClick={() => setViewMode('trend')}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${viewMode === 'trend'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                  }`}
              >
                추이 보기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 추이 차트 */}
      {hasMultipleWeeks && viewMode === 'trend' && (
        <>
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">설문 선택</h3>
            <div className="flex flex-wrap gap-2">
              {surveyNames.map((name) => (
                <div key={name} className="relative group">
                  <motion.button
                    onClick={() => setSelectedSurveyForTrend(name)}
                    whileHover={{ scale: selectedSurveyForTrend === name ? 1.16 : 1.12 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${
                      selectedSurveyForTrend === name
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-stone-100 text-stone-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {name}
                  </motion.button>

                  {/* 버튼 위쪽에 즉시 뜨는 툴팁 */}
                  {SURVEY_META[name]?.desc && (
                    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50
                                      origin-bottom scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100
                                      transition duration-150 whitespace-nowrap rounded-md bg-stone-800 text-white
                                      text-xs px-2 py-1 shadow">
                      {SURVEY_META[name].desc}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <TrendChart
            key={chartKey}
            surveyName={selectedSurveyForTrend ?? ''}
            invertGradient={
              !!(selectedSurveyForTrend && SURVEY_META[selectedSurveyForTrend]?.invert)
            }
            yDomain={yDomainForSelected}
            subScaleRanges={continuousSeriesRanges}
            mode={
              isContinuousSelected
                ? { kind: 'continuous', data: continuousTrendData, series: continuousSeriesNames }
                : { kind: 'categorical', data: categoricalTrendData }
            }
          />
        </>
      )}

      {/* 카드 보기 */}
      {viewMode === 'cards' && (
        <>
          {hasMultipleWeeks && (
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-stone-700 mb-3">주차 선택</h3>
              <div className="flex flex-wrap gap-2">
                {weeks.map((week) => (
                  <motion.button
                    key={week}
                    onClick={() => setSelectedWeek(week)}
                    whileHover={{ scale: selectedWeek === week ? 1.14 : 1.10 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg
                      ${selectedWeek === week
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-stone-100 text-stone-700 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                  >
                    {`Week ${week}`}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
            {blocksToShow.map((block, index) => {
              const analysisResult = analyzeSurveyBlock(block);
              return (
                <ResultCard key={`${block.name}-${index}`} result={analysisResult} />
              );
            })}
          </div>
        </>
      )}

      {/* === 페이지 하단 추출 섹션 === */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <FileDown className="w-6 h-6 text-sky-600" />
              데이터 추출 (CSV 파일 형식)
            </h3>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => handleExport('analysis')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            >
              <Download className="w-4 h-4" />
              분석 결과 추출
            </button>
            <button
              onClick={() => handleExport('raw')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all bg-sky-600 text-white hover:bg-sky-700 shadow-sm"
            >
              <Download className="w-4 h-4" />
              원본 데이터 추출
            </button>
          </div>
        </div>
      </div>
      {/* ======================================= */}

    </div>
  );
}