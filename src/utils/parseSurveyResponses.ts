// src/utils/parseSurveyResponses.ts

export type SurveyItem = {
  idx: number;
  question: string;
  options: string[];
  selectedIndex: number | null;
  selectedText: string | null;
};

export type SurveyBlock = {
  name: string;     // 예: "PHQ-9", "GAD-7", "CES-D", "CNS-VS"
  uid?: string;
  week?: number | string;
  items: SurveyItem[];
};

const ITEM_KEY_RE =
  /^(?<name>[^[]+)\[(?<idx>\d+)\]\.(?<field>question|options\[(?<optIdx>\d+)\]|answers\[(?<ansIdx>\d+)\])$/;

export function parseSurveyFromRow(row: Record<string, any>): SurveyBlock[] {
  console.log('[parseSurveyFromRow] 설문 데이터 파싱 시작, 입력 행:', row);
  const bySurvey = new Map<string, { items: Map<number, SurveyItem> }>();

  const uid = row["uid"];
  const week = row["week"];

  for (const [key, value] of Object.entries(row)) {
    // 값이 비어있으면(null, undefined, NaN) 건너뛰어 파싱 성능을 최적화합니다.
    if (value == null || (typeof value === 'number' && isNaN(value))) continue;

    const m = key.match(ITEM_KEY_RE);
    if (!m || !m.groups) continue;

    const name = m.groups.name.trim();       // 예: "PHQ-9"
    const idx = Number(m.groups.idx);

    if (!bySurvey.has(name)) {
      bySurvey.set(name, { items: new Map() });
    }
    const s = bySurvey.get(name)!;

    if (!s.items.has(idx)) {
      s.items.set(idx, {
        idx,
        question: "",
        options: [],
        selectedIndex: null,
        selectedText: null,
      });
    }
    const item = s.items.get(idx)!;

    // 필드 분기
    if (m.groups.field.startsWith("options[")) {
      const optIdx = Number(m.groups.optIdx);
      item.options[optIdx] = value ?? "";
    } else if (m.groups.field.startsWith("answers[")) {
      const ansIdx = Number(m.groups.ansIdx);
      const chosen = value === true || value === "true" || value === 1 || value === "1";
      if (chosen) {
        item.selectedIndex = ansIdx;
      }
    } else if (m.groups.field === "question") {
      item.question = (value ?? "").toString();
    }
  }

  // selectedText 채우기 + 정렬
  const result: SurveyBlock[] = [];
  for (const [name, { items }] of bySurvey.entries()) {
    const arr = Array.from(items.values()).sort((a, b) => a.idx - b.idx);
    for (const it of arr) {
      it.selectedText =
        it.selectedIndex != null ? (it.options?.[it.selectedIndex] ?? null) : null;
    }
    
    const finalBlock = { name, uid, week, items: arr };

    // ✅ 추가된 부분: 응답한 항목이 하나라도 있는 설문 블록만 결과에 포함시킵니다.
    const hasAnyAnswer = finalBlock.items.some(item => item.selectedIndex !== null);
    if (hasAnyAnswer) {
      result.push(finalBlock);
    } else {
      console.log(`[parseSurveyFromRow] '${name}' 설문은 응답이 없어 제외합니다.`);
    }
  }
  
  console.log('[parseSurveyFromRow] 파싱 완료, 유효한 결과 블록:', result);
  return result;
}