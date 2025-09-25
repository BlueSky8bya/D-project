// src/components/SurveyResultsViewer.tsx

import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import type { SurveyBlock } from '../utils/parseSurveyResponses';
import { analyzeSurveyBlock, type AnalysisResult } from '../utils/surveyAnalysis';

type Props = {
  surveyBlocks: SurveyBlock[];
};

// --- 타입 정의 ---
type SubScale = NonNullable<AnalysisResult['subScales']>[number];
type Category = NonNullable<AnalysisResult['categories']>[number];

// --- UI 컴포넌트 ---

const ContinuousBar: React.FC<{ scale: SubScale; reverseColor?: boolean }> = ({ scale, reverseColor = false }) => {
    if (scale.min === undefined || scale.max === undefined || typeof scale.score !== 'number') return null;
    const percentage = scale.max > scale.min ? (scale.score - scale.min) / (scale.max - scale.min) * 100 : 0;
  
    const gradientClass = reverseColor 
        ? 'bg-gradient-to-r from-red-500 to-green-400' 
        : 'bg-gradient-to-r from-green-400 to-red-500';

    return (
      <div className="text-sm">
        <div className="flex justify-between items-center mb-1">
          <span className="text-stone-600">{scale.name}</span>
          <span className="font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded">{scale.score} / {scale.max}</span>
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
  
const CategoricalDisplay: React.FC<{ categories: Category[]; name: string }> = ({ categories = [], name }) => {
    const getColors = (count: number, index: number) => {
        const scales: { [key: number]: { textBg: string; border: string }[] } = {
            2: [
                { textBg: 'text-green-800 bg-green-100', border: 'border-green-500' },
                { textBg: 'text-red-800 bg-red-100', border: 'border-red-500' }
            ],
            3: [
                { textBg: 'text-green-800 bg-green-100', border: 'border-green-500' },
                { textBg: 'text-yellow-800 bg-yellow-100', border: 'border-yellow-500' },
                { textBg: 'text-red-800 bg-red-100', border: 'border-red-500' }
            ],
            4: [
                { textBg: 'text-green-800 bg-green-100', border: 'border-green-500' },
                { textBg: 'text-yellow-800 bg-yellow-100', border: 'border-yellow-500' },
                { textBg: 'text-orange-800 bg-orange-100', border: 'border-orange-500' },
                { textBg: 'text-red-800 bg-red-100', border: 'border-red-500' }
            ],
            5: [
                { textBg: 'text-green-800 bg-green-100', border: 'border-green-500' },
                { textBg: 'text-lime-800 bg-lime-100', border: 'border-lime-500' },
                { textBg: 'text-yellow-800 bg-yellow-100', border: 'border-yellow-500' },
                { textBg: 'text-orange-800 bg-orange-100', border: 'border-orange-500' },
                { textBg: 'text-red-800 bg-red-100', border: 'border-red-500' }
            ],
        };
        return (scales[count] || [{ textBg: 'text-stone-800 bg-stone-100', border: 'border-stone-500' }])[index];
    };

    return (
        <div className="mt-4 grid grid-cols-1 gap-1 text-xs">
            {categories.map((cat, index) => {
                const colors = getColors(categories.length, index);
                const currentClass = cat.isCurrent ? `border-2 ${colors.border} font-bold` : 'border border-transparent';
                
                return (
                    <div
                        key={cat.name}
                        className={`p-2 rounded-md flex justify-between items-center transition-all ${colors.textBg} ${currentClass}`}
                    >
                        <span>{cat.name}</span>
                        {name !== "S-Scale-A" && <span className="font-mono">{cat.scoreRange}점</span>}
                    </div>
                );
            })}
        </div>
    );
};

const ResultCard: React.FC<{ result: AnalysisResult }> = ({ result }) => {
    const getCurrentScoreColor = () => {
        if (!result.categories) return 'text-emerald-600';
        const currentIndex = result.categories.findIndex(c => c.isCurrent);
        if (currentIndex === -1) return 'text-emerald-600';
        const colorMap: { [key: number]: string[] } = {
            2: ['text-green-600', 'text-red-600'],
            3: ['text-green-600', 'text-yellow-600', 'text-red-600'],
            4: ['text-green-600', 'text-yellow-600', 'text-orange-600', 'text-red-600'],
            5: ['text-green-600', 'text-lime-600', 'text-yellow-600', 'text-orange-600', 'text-red-600'],
        };
        return (colorMap[result.categories.length] || ['text-emerald-600'])[currentIndex];
    };

    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm flex flex-col h-full">
        <div>
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-stone-800">{result.name}</h4>
              <p className="text-xs text-stone-500 mt-1">{result.description}</p>
            </div>
            {!result.categories && (
              <div className="relative group">
                <Info className="w-4 h-4 text-stone-400" />
                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 text-xs text-white bg-stone-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    {result.interpretation}
                </div>
              </div>
            )}
          </div>
    
          <div className="mt-2 flex items-baseline gap-2">
            {result.totalScore !== undefined && (
              <p className={`text-2xl font-bold ${getCurrentScoreColor()}`}>{result.totalScore}점</p>
            )}
          </div>
        </div>
        
        <div>
            {result.categories && <CategoricalDisplay categories={result.categories} name={result.name} />}

            {result.subScales?.some(s => s.min !== undefined) && (
                <div className="mt-3 border-t border-stone-200 pt-3 space-y-3">
                    {result.subScales?.map(scale => (
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

// --- 메인 뷰어 컴포넌트 ---
export default function SurveyResultsViewer({ surveyBlocks }: Props) {
    // ... (이하 코드는 이전과 동일)
    const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

    const groupedByWeek = useMemo(() => {
      return surveyBlocks.reduce((acc, block) => {
        const week = String(block.week ?? 'N/A');
        if (!acc[week]) acc[week] = [];
        acc[week].push(block);
        return acc;
      }, {} as Record<string, SurveyBlock[]>);
    }, [surveyBlocks]);
  
    const weeks = Object.keys(groupedByWeek).sort((a, b) => Number(a) - Number(b));
  
    if (selectedWeek === null && weeks.length > 0) {
      setSelectedWeek(weeks[weeks.length - 1]);
    }
  
    const blocksToShow = selectedWeek ? groupedByWeek[selectedWeek] : [];
  
    if (surveyBlocks.length === 0) {
      return <div className="text-sm text-gray-500">표시할 설문 응답이 없습니다.</div>;
    }
  
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
          {weeks.map(week => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`px-3 py-1 text-sm font-semibold rounded-full ${ selectedWeek === week ? 'bg-emerald-600 text-white' : 'bg-white text-stone-700 hover:bg-emerald-50'}`}
            >
              Week {week}
            </button>
          ))}
        </div>
  
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocksToShow.map((block, index) => {
            const analysisResult = analyzeSurveyBlock(block);
            return <ResultCard key={`${block.name}-${index}`} result={analysisResult} />;
          })}
        </div>
      </div>
    );
}