// src/features/StepCount/StepCountViewer.tsx

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { normalizeStepCount } from './parseStepCount';

export default function StepCountViewer({ rows }: { rows: any[] }) {
  const { points, daily } = useMemo(() => normalizeStepCount(rows), [rows]);
  const [tab, setTab] = useState<'series'|'daily'|'table'>('series');

  const series = points.map(p => ({
    time: new Date(p.ts).toISOString().slice(0,16).replace('T',' '),
    steps: p.steps
  }));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['series','daily','table'] as const).map(k => (
          <button key={k} className={`px-3 py-1 rounded border ${tab===k?'bg-black text-white':''}`} onClick={()=>setTab(k)}>
            {k==='series'?'시계열':k==='daily'?'일별 합계':'표'}
          </button>
        ))}
      </div>

      {tab==='series' && (
        <div style={{width:'100%', height:280}}>
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="steps" />
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
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab==='table' && (
        <div className="overflow-auto border rounded p-2 text-sm">
          <table>
            <thead><tr><th className="px-2 text-left">time</th><th className="px-2">steps</th></tr></thead>
            <tbody>
              {series.slice(0,1000).map((r,i)=>(
                <tr key={i}><td className="px-2">{r.time}</td><td className="px-2">{r.steps}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
