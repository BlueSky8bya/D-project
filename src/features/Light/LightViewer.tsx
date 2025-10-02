// src/features/Light/LightViewer.tsx

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import type { NormalizeResult } from '../../lib/utils/normalizeRows';

type Props = {
  fileName: string;
  normalized: NormalizeResult;
};

function downsample<T>(arr: T[], max = 20000): T[] {
  const n = arr.length;
  if (n <= max) return arr;
  const step = Math.ceil(n / max);
  const out: T[] = [];
  for (let i = 0; i < n; i += step) out.push(arr[i]);
  return out;
}

export default function LightViewer({ fileName: _fileName, normalized }: Props) {
  void _fileName;

  const data = useMemo(() => {
    const rows = normalized.rows.filter((r: any) => r.ts != null);
    return downsample(rows, 20000);
  }, [normalized]);

  const xDomain: [number, number] | undefined = useMemo(() => {
    if (!data.length) return undefined;
    let min = data[0].ts as number;
    let max = data[0].ts as number;
    for (let i = 1; i < data.length; i++) {
      const t = data[i].ts as number;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    if (min === max) max = min + 1;
    return [min, max];
  }, [data]);

  const xTick = (t: number) =>
    new Date(t).toLocaleTimeString(undefined, { hour12: false });

  if (normalized.shape === 'mono') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ts" type="number" domain={xDomain} tickFormatter={xTick} />
          <YAxis />
          <Tooltip labelFormatter={(l) => xTick(l as number)} />
          <Area dataKey="value" name="value" stroke="#16a34a" fill="#bbf7d0" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="ts" type="number" domain={xDomain} tickFormatter={xTick} />
        <YAxis />
        <Tooltip labelFormatter={(l) => xTick(l as number)} />
        <Line dataKey="x" name="x" stroke="#16a34a" dot={false} isAnimationActive={false} />
        <Line dataKey="y" name="y" stroke="#65a30d" dot={false} isAnimationActive={false} />
        <Line dataKey="z" name="z" stroke="#f59e0b" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
