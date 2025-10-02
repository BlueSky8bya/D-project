// src/features/EMA/EMAViewer.tsx

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { normalizeEMA } from './parseEMA';
import type { EMA } from './parseEMA';

export default function EMAViewer({ rows }: { rows: any[] }) {
  const data = useMemo<EMA[]>(() => normalizeEMA(rows), [rows]);
  const [tab, setTab] = useState<'trend'|'daily'|'table'>('trend');

  const series = data.map(d => ({
    time: new Date(d.ts).toISOString().slice(0,16).replace('T',' '),
    mood: d.mood,
    stress: d.stress,
    anxiety: d.anxiety,
  }));

  const daily = useMemo(() => {
    const map = new Map<string, {cnt:number; mood:number; stress:number; anxiety:number}>();
    for (const s of series) {
      const date = s.time.slice(0,10);
      const cur = map.get(date) ?? {cnt:0, mood:0, stress:0, anxiety:0};
      cur.cnt++;
      cur.mood += s.mood ?? 0;
      cur.stress += s.stress ?? 0;
      cur.anxiety += s.anxiety ?? 0;
      map.set(date, cur);
    }
    return [...map.entries()].map(([date, v]) => ({
      date,
      mood: v.cnt? v.mood/v.cnt: undefined,
      stress: v.cnt? v.stress/v.cnt: undefined,
      anxiety: v.cnt? v.anxiety/v.cnt: undefined,
      cnt: v.cnt
    }));
  }, [series]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['trend','daily','table'] as const).map(k => (
          <button key={k} className={`px-3 py-1 rounded border ${tab===k?'bg-black text-white':''}`} onClick={()=>setTab(k)}>
            {k==='trend'?'추세(0~100)':k==='daily'?'일자별 평균':'표'}
          </button>
        ))}
      </div>

      {tab==='trend' && (
        <div style={{width:'100%', height:300}}>
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0,100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="mood" />
              <Line type="monotone" dataKey="stress" />
              <Line type="monotone" dataKey="anxiety" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab==='daily' && (
        <div style={{width:'100%', height:280}}>
          <ResponsiveContainer>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0,100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="mood" />
              <Bar dataKey="stress" />
              <Bar dataKey="anxiety" />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-500 mt-1">막대는 일자별 평균값, 툴팁에서 표본수(cnt) 확인</div>
        </div>
      )}

      {tab==='table' && (
        <div className="overflow-auto border rounded p-2 text-sm">
          <table>
            <thead>
              <tr><th className="px-2 text-left">time</th><th className="px-2">mood</th><th className="px-2">stress</th><th className="px-2">anxiety</th><th className="px-2 text-left">context</th></tr>
            </thead>
            <tbody>
              {data.slice(0,500).map((d,i)=>(
                <tr key={i}>
                  <td className="px-2">{new Date(d.ts).toLocaleString()}</td>
                  <td className="px-2">{d.mood ?? ''}</td>
                  <td className="px-2">{d.stress ?? ''}</td>
                  <td className="px-2">{d.anxiety ?? ''}</td>
                  <td className="px-2">{d.context ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
