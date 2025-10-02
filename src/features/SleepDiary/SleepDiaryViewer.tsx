// src/feature/SleepDiary/SleepDiaryViewer.tsx

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { normalizeSleepDiary } from './parseSleepDiary';
import type { SleepDiary } from './parseSleepDiary';

export default function SleepDiaryViewer({ rows }: { rows: any[] }) {
  const data = useMemo<SleepDiary[]>(() => normalizeSleepDiary(rows), [rows]);
  const [tab, setTab] = useState<'duration'|'times'|'table'>('duration');

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['duration','times','table'] as const).map(k => (
          <button key={k}
            className={`px-3 py-1 rounded border ${tab===k?'bg-black text-white':''}`}
            onClick={()=>setTab(k)}>{k==='duration'?'일별 수면시간':k==='times'?'취침/기상 시각':'표'}</button>
        ))}
      </div>

      {tab==='duration' && (
        <div style={{width:'100%', height:280}}>
          <ResponsiveContainer>
            <BarChart data={data.map(d => ({ date:d.date, minutes:d.totalSleepMin }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="minutes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab==='times' && (
        <div style={{width:'100%', height:300}}>
          <ResponsiveContainer>
            <LineChart data={data.map(d => ({ date:d.date, onset:d.onsetHour, wake:d.wakeHour }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0,24]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="onset" />
              <Line type="monotone" dataKey="wake" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab==='table' && (
        <div className="overflow-auto border rounded p-2 text-sm">
          <table>
            <thead>
              <tr>
                <th className="px-2 text-left">date</th>
                <th className="px-2 text-left">totalSleepMin</th>
                <th className="px-2 text-left">latency</th>
                <th className="px-2 text-left">waso</th>
                <th className="px-2 text-left">eff(%)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r,i)=>(
                <tr key={i}>
                  <td className="px-2">{r.date}</td>
                  <td className="px-2">{Math.round(r.totalSleepMin)}</td>
                  <td className="px-2">{r.latencyMin ?? ''}</td>
                  <td className="px-2">{r.wasoMin ?? ''}</td>
                  <td className="px-2">{r.efficiencyPct ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
