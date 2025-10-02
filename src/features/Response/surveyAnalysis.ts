// src/utils/surveyAnalysis.ts

import type { SurveyBlock } from './parseSurveyResponses';

// --- 타입 정의 (시각화 데이터 필드 추가) ---
export type AnalysisResult = {
  name: string;
  description: string;
  totalScore?: number;
  interpretation?: string;
  // 범주형 시각화 데이터
  categories?: { name: string; scoreRange: string; isCurrent: boolean }[];
  // 연속형 시각화 데이터
  subScales?: { name: string; score: number | string; min?: number; max?: number }[];
};

// --- 점수 계산 헬퍼 함수 ---
const sumScores = (items: SurveyBlock['items'], indices?: number[]): number => {
  const targetItems = indices ? items.filter(item => indices.includes(item.idx + 1)) : items;
  return targetItems.reduce((sum, item) => sum + (item.selectedIndex ?? 0), 0);
};

const getScore = (item: SurveyBlock['items'][0], reverse: boolean = false): number => {
  const score = item.selectedIndex ?? 0;
  if (!reverse) return score;
  const maxScore = item.options.length - 1;
  return maxScore - score;
};

// --- 설문별 분석 함수 (시각화 데이터 적용) ---

function analyzePhq9(block: SurveyBlock): AnalysisResult {
    const totalScore = sumScores(block.items);
    const item1 = block.items[0]?.selectedIndex ?? 0;
    const item2 = block.items[1]?.selectedIndex ?? 0;
    let interpretation = "우울 아님";

    if (item1 >= 2 || item2 >= 2) {
        if (totalScore >= 20) interpretation = "심한 증상";
        else if (totalScore >= 15) interpretation = "중한 증상";
        else if (totalScore >= 10) interpretation = "경미한 증상";
        else if (totalScore >= 5) interpretation = "가벼운 증상";
    }
    
    const categories = [
        { name: "우울 아님", scoreRange: "0-4", isCurrent: interpretation === "우울 아님" },
        { name: "가벼운 증상", scoreRange: "5-9", isCurrent: interpretation === "가벼운 증상" },
        { name: "경미한 증상", scoreRange: "10-14", isCurrent: interpretation === "경미한 증상" },
        { name: "중한 증상", scoreRange: "15-19", isCurrent: interpretation === "중한 증상" },
        { name: "심한 증상", scoreRange: "20-27", isCurrent: interpretation === "심한 증상" },
    ];

    return { name: "PHQ-9", description: "우울증 건강설문 (9문항)", totalScore, interpretation, categories };
}

function analyzeCesd(block: SurveyBlock): AnalysisResult {
    const reverseItems = [4, 8, 12, 16];
    const totalScore = block.items.reduce((sum, item) => {
        const isReverse = reverseItems.includes(item.idx + 1);
        return sum + getScore(item, isReverse);
    }, 0);

    let interpretation = "정상";
    if (totalScore >= 25) interpretation = "심한 우울";
    else if (totalScore >= 21) interpretation = "중한 우울";
    else if (totalScore >= 16) interpretation = "경미한 우울";
    
    const categories = [
        { name: "정상", scoreRange: "0-15", isCurrent: interpretation === "정상" },
        { name: "경미한 우울", scoreRange: "16-20", isCurrent: interpretation === "경미한 우울" },
        { name: "중한 우울", scoreRange: "21-24", isCurrent: interpretation === "중한 우울" },
        { name: "심한 우울", scoreRange: "25-60", isCurrent: interpretation === "심한 우울" },
    ];
    
    return { name: "CES-D", description: "역학연구용 우울척도", totalScore, interpretation, categories };
}

function analyzeGad7(block: SurveyBlock): AnalysisResult {
    const totalScore = sumScores(block.items);
    const interpretation = totalScore >= 6 ? "불안 시사" : "불안 아님";
    const categories = [
        { name: "불안 아님", scoreRange: "0-5", isCurrent: interpretation === "불안 아님" },
        { name: "불안 시사", scoreRange: "6-21", isCurrent: interpretation === "불안 시사" },
    ];
    return { name: "GAD-7", description: "일반화된 불안장애 척도", totalScore, interpretation, categories };
}

function analyzeIsi(block: SurveyBlock): AnalysisResult {
    const totalScore = sumScores(block.items);
    let interpretation = "불면증 아님";
    if (totalScore >= 22) interpretation = "심각한 수준";
    else if (totalScore >= 15) interpretation = "중한 수준";
    else if (totalScore >= 8) interpretation = "경미한 수준";
    
    const categories = [
        { name: "불면증 아님", scoreRange: "0-7", isCurrent: interpretation === "불면증 아님" },
        { name: "경미한 수준", scoreRange: "8-14", isCurrent: interpretation === "경미한 수준" },
        { name: "중한 수준", scoreRange: "15-21", isCurrent: interpretation === "중한 수준" },
        { name: "심각한 수준", scoreRange: "22-28", isCurrent: interpretation === "심각한 수준" },
    ];
    
    return { name: "ISI", description: "불면증 심각도 척도", totalScore, interpretation, categories };
}

function analyzeStress20(block: SurveyBlock): AnalysisResult {
    const subScales = [
        { name: '분노·공격성', score: sumScores(block.items, [9, 10, 11, 12, 13, 14, 15, 16, 18, 19]), min: 0, max: 40 },
        { name: '걱정·긴장', score: sumScores(block.items, [1, 2, 3, 4, 5, 6, 7, 8]), min: 0, max: 32 },
        { name: '자기평가 저하/우울', score: sumScores(block.items, [17, 20]), min: 0, max: 8 },
    ];
    
    const totalScore = subScales.reduce((sum, scale) => sum + (scale.score as number), 0);

    return { name: "Stress-20", description: "스트레스 척도 (20문항)", totalScore, interpretation: "점수가 높을수록 스트레스 지수 높음", subScales };
}

function analyzeInq(block: SurveyBlock): AnalysisResult {
    const pbIndices = [1, 2, 3, 4, 5, 6];
    const tbIndices = [7, 8, 9, 10, 11, 12, 13];
    const reverseIndices = [7, 8, 11, 12, 13];
    let pbScore = 0, tbScore = 0;

    block.items.forEach(item => {
        const itemNum = item.idx + 1;
        const score = getScore(item, reverseIndices.includes(itemNum));
        if (pbIndices.includes(itemNum)) pbScore += score;
        if (tbIndices.includes(itemNum)) tbScore += score;
    });
    
    const subScales = [
        { name: '지각된 부담감 (PB)', score: parseFloat((pbScore / pbIndices.length).toFixed(2)), min: 0, max: 6 },
        { name: '좌절된 소속감 (TB)', score: parseFloat((tbScore / tbIndices.length).toFixed(2)), min: 0, max: 6 },
    ];
    
    return { name: "INQ", description: "대인관계 욕구 척도", interpretation: "하위 요인별 평균 점수", subScales };
}

function analyzeWhoqol(block: SurveyBlock): AnalysisResult {
    const reverseIndices = [3, 4, 26];
    const scales = {
        '신체적 건강': [3, 4, 10, 15, 16, 17, 18], '심리적 건강': [5, 6, 7, 11, 19, 26],
        '사회적 관계': [20, 21, 22], '환경': [8, 9, 12, 13, 14, 23, 24, 25], '전반': [1, 2],
    };

    const subScales = Object.entries(scales).map(([name, indices]) => {
        const score = block.items.filter(item => indices.includes(item.idx + 1))
            .reduce((sum, item) => sum + getScore(item, reverseIndices.includes(item.idx + 1)), 0);
        return { name, score, min: 0, max: indices.length * 4 };
    });

    return { name: "WHOQOL-BREF", description: "세계보건기구 삶의 질 척도", interpretation: "영역별 삶의 질 점수", subScales };
}

function analyzeSScaleA(block: SurveyBlock): AnalysisResult {
    const reverseIndices = [4, 10, 15];
    const getSScaleScore = (item: SurveyBlock['items'][0], reverse: boolean = false): number => {
        const score = (item.selectedIndex ?? 0) + 1; return reverse ? 5 - score : score;
    };
    const factor1Indices = [1, 5, 9, 12, 15];
    const factor3Indices = [4, 8, 11, 14];
    const factor4Indices = [3, 7, 10, 13];
    
    const totalScore = block.items.reduce((sum, item) => sum + getSScaleScore(item, reverseIndices.includes(item.idx + 1)), 0);
    const factor1Score = block.items.filter(it => factor1Indices.includes(it.idx + 1)).reduce((sum, it) => sum + getSScaleScore(it, reverseIndices.includes(it.idx + 1)), 0);
    const factor3Score = block.items.filter(it => factor3Indices.includes(it.idx + 1)).reduce((sum, it) => sum + getSScaleScore(it, reverseIndices.includes(it.idx + 1)), 0);
    const factor4Score = block.items.filter(it => factor4Indices.includes(it.idx + 1)).reduce((sum, it) => sum + getSScaleScore(it, reverseIndices.includes(it.idx + 1)), 0);

    let interpretation = '일반사용자군';
    if (totalScore >= 44 || (factor1Score >= 15 && factor3Score >= 13 && factor4Score >= 13)) interpretation = '고위험사용자군';
    else if (totalScore >= 40 || factor1Score >= 14) interpretation = '잠재적 위험사용자군';
    
    const categories = [
        { name: '일반사용자군', scoreRange: '총점 39점 이하', isCurrent: interpretation === '일반사용자군' },
        { name: '잠재적 위험사용자군', scoreRange: '총점 40-43점', isCurrent: interpretation === '잠재적 위험사용자군' },
        { name: '고위험사용자군', scoreRange: '총점 44점 이상', isCurrent: interpretation === '고위험사용자군' },
    ];

    return { name: "S-Scale-A", description: "스마트폰중독 측정척도", totalScore, interpretation, categories };
}

function analyzeHamd(block: SurveyBlock): AnalysisResult {
    const scales = {
        '생리적/불안': { indices: [4, 5, 6, 10, 11, 12, 13, 15, 16, 17], max: 26 },
        '정신운동 변화': { indices: [1, 2, 3, 7, 8, 9], max: 24 },
    };

    // --- 16A/B 규칙 적용 (Index 기반) ---
    // CSV 구조에 따라, 16A는 index 15, 16B는 index 16에 해당합니다.
    const score16A = block.items.find(item => item.idx === 15)?.selectedIndex;
    const score16B = block.items.find(item => item.idx === 16)?.selectedIndex;

    let finalScore16 = 0;
    // 규칙 1: 16B(실제) 값이 있으면 우선적으로 사용 (0도 유효한 값이므로 null/undefined만 체크)
    if (score16B != null) {
        finalScore16 = score16B;
    } 
    // 규칙 2: 16B가 없을 때 16A(자가보고) 값이 있으면 사용
    else if (score16A != null) {
        finalScore16 = score16A;
    }
    // 규칙 3: 둘 다 없으면 0점 유지

    // 최종 점수 계산을 위한 Map 생성
    const finalScores = new Map<number, number>();
    block.items.forEach(item => {
        // 16A (idx:15) 와 16B (idx:16)는 건너뜁니다.
        if (item.idx === 15 || item.idx === 16) {
            return;
        }
        // 17번 문항(idx:17)까지만 포함합니다.
        if (item.idx <= 17) {
            finalScores.set(item.idx + 1, item.selectedIndex ?? 0);
        }
    });
    // 규칙에 따라 확정된 16번 문항 점수를 추가합니다.
    finalScores.set(16, finalScore16);
    
    const subScales = Object.entries(scales).map(([name, {indices, max}]) => ({
         name,
         score: indices.reduce((sum, index) => sum + (finalScores.get(index) ?? 0), 0),
         min: 0,
         max,
    }));

    const totalScore = Array.from(finalScores.values()).reduce((sum, score) => sum + score, 0);
    subScales.push({ name: '일반 우울 (총점)', score: totalScore, min: 0, max: 52 }); // 최대 점수는 참고용

    return { name: "HAM-D", description: "해밀턴 우울증 척도", totalScore, interpretation: "하위 요인별 점수 (높을수록 증상 심각)", subScales };
}

// --- 메인 분석 라우터 함수 ---
export function analyzeSurveyBlock(block: SurveyBlock): AnalysisResult {
  const surveyName = block.name.toUpperCase();

  if (surveyName.includes('PHQ-9')) return analyzePhq9(block);
  if (surveyName.includes('CES-D')) return analyzeCesd(block);
  if (surveyName.includes('GAD-7')) return analyzeGad7(block);
  if (surveyName.includes('ISI')) return analyzeIsi(block);
  if (surveyName.includes('STRESS')) return analyzeStress20(block);
  if (surveyName.includes('INQ')) return analyzeInq(block);
  if (surveyName.includes('WHOQOL')) return analyzeWhoqol(block);
  if (surveyName.includes('S-SCALE')) return analyzeSScaleA(block);
  if (surveyName.includes('HAM-D')) return analyzeHamd(block);
  if (surveyName.includes('HAM-A')) return { name: block.name, description: "해밀턴 불안 척도", interpretation: "분석 보류: 의사 평가용 설문입니다." };
  if (surveyName.includes('CNS-VS')) return { name: block.name, description: "전산화 신경인지기능 검사", interpretation: "분석 보류: 객관적 수행 데이터가 필요합니다." };
  
  return { name: block.name, description: "알 수 없는 설문", interpretation: "분석 로직이 아직 구현되지 않았습니다." };
}