// src/components/SurveyViewer.tsx

import React from 'react'; // React.memo를 사용하기 위해 import 합니다.
import type { SurveyBlock } from "../utils/parseSurveyResponses";

type Props = {
  surveys: SurveyBlock[];
};

function SurveyViewer({ surveys }: Props) {
  if (!surveys?.length) {
    return <div className="text-sm text-gray-500">표시할 설문 응답이 없습니다.</div>;
  }

  return (
    <div className="space-y-6">
      {surveys.map((s) => (
        <div key={s.name} className="rounded-2xl shadow p-4 bg-[#FFF9F0] border border-emerald-100">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-lg font-semibold text-emerald-700">
              {s.name}
            </h3>
            <div className="text-xs text-gray-500">
              {s.uid ? <>UID: <span className="font-mono">{s.uid}</span>&nbsp;&nbsp;</> : null}
              {s.week != null ? <>week: <span className="font-mono">{s.week}</span></> : null}
            </div>
          </div>

          <ol className="space-y-3 list-decimal list-inside">
            {s.items.map((it) => (
              <li key={it.idx} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="text-sm font-medium mb-2">{it.question || `문항 ${it.idx + 1}`}</div>

                <ul className="space-y-1">
                  {it.options.map((opt, i) => {
                    const chosen = i === it.selectedIndex;
                    return (
                      <li
                        key={i}
                        className={`text-sm ${
                          chosen
                            ? "font-semibold text-emerald-700"
                            : "text-gray-700"
                        }`}
                      >
                        {chosen ? "● " : "○ "}{opt}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

export default React.memo(SurveyViewer);