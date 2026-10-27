'use client';
import * as React from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipProps,
} from 'recharts';

/** Chart tokens: recessive hairline grid, muted axis text, text never in series colour. */
export const CHART = {
  grid: '#E6ECF3',
  axis: '#5B6B82',
  text: '#0F2A52',
  surface: '#FFFFFF',
  tick: { fontSize: 11, fill: '#5B6B82' },
};

/** Validated categorical order (blue, orange, aqua, yellow, magenta, green, violet) + neutral "Other". */
export const CATEGORICAL = ['#1A6FC4', '#E67E22', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6'];
export const OTHER_GRAY = '#9AA9BF';

const compact = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}K` : String(n));

function TooltipBox({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <div className="mb-1 font-semibold text-navy">{label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-navy">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: (p.payload?.fill as string) ?? p.color }} aria-hidden />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function LegendRow({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-[11px] text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export interface Series { key: string; label: string; color: string }

/** Horizontal bars, single series, value at the tip. */
export function HBarChart<T extends Record<string, unknown>>({ data, labelKey, valueKey, valueLabel, color = '#1A6FC4', height, onClick, colorFor }: {
  data: T[]; labelKey: keyof T & string; valueKey: keyof T & string; valueLabel: string; color?: string; height?: number; onClick?: (row: T) => void; colorFor?: (row: T) => string;
}) {
  const h = height ?? Math.max(160, data.length * 30 + 30);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" tick={CHART.tick} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compact} />
        <YAxis type="category" dataKey={labelKey} tick={{ ...CHART.tick, fill: CHART.text }} width={96} axisLine={false} tickLine={false} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: '#EEF2F7' }} />
        <Bar
          dataKey={valueKey}
          name={valueLabel}
          fill={color}
          barSize={18}
          radius={[0, 4, 4, 0]}
          label={{ position: 'right', fill: CHART.text, fontSize: 11, fontWeight: 600 }}
          onClick={onClick ? (d: { payload?: T }) => d.payload && onClick(d.payload) : undefined}
          cursor={onClick ? 'pointer' : undefined}
        >
          {colorFor && data.map((row, i) => <Cell key={i} fill={colorFor(row)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Columns: one or more series (grouped). Per-bar colours allowed for a single ordered series. */
export function ColumnChart<T extends Record<string, unknown>>({ data, xKey, series, height = 240, barColors, showValues, angleTicks, thinTicks }: {
  data: T[]; xKey: keyof T & string; series: Series[]; height?: number; barColors?: string[]; showValues?: boolean; angleTicks?: boolean;
  /** Let the axis drop labels that would collide (for long series such as 12 months). */
  thinTicks?: boolean;
}) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: showValues ? 18 : 8, right: 8, bottom: angleTicks ? 40 : 4, left: -12 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey={xKey} tick={CHART.tick} axisLine={{ stroke: CHART.grid }} tickLine={false} interval={thinTicks ? 'preserveStartEnd' : 0} minTickGap={thinTicks ? 6 : 0} angle={angleTicks ? -30 : 0} textAnchor={angleTicks ? 'end' : 'middle'} height={angleTicks ? 60 : 30} />
          <YAxis tick={CHART.tick} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compact} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: '#EEF2F7' }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]} label={showValues ? { position: 'top', fill: CHART.text, fontSize: 11, fontWeight: 600 } : undefined}>
              {barColors && series.length === 1 && data.map((_, i) => <Cell key={i} fill={barColors[i % barColors.length]} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      {series.length > 1 && <LegendRow items={series.map((s) => ({ label: s.label, color: s.color }))} />}
    </div>
  );
}

export function LineTrendChart<T extends Record<string, unknown>>({ data, xKey, series, height = 240 }: { data: T[]; xKey: keyof T & string; series: Series[]; height?: number }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: -12 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey={xKey} tick={CHART.tick} axisLine={{ stroke: CHART.grid }} tickLine={false} />
          <YAxis tick={CHART.tick} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compact} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: '#9AA9BF', strokeWidth: 1 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              dot={{ r: 4, fill: s.color, stroke: CHART.surface, strokeWidth: 2 }} activeDot={{ r: 6, stroke: CHART.surface, strokeWidth: 2 }} />
          ))}
          <Legend content={() => (series.length > 1 ? <LegendRow items={series.map((s) => ({ label: s.label, color: s.color }))} /> : null)} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with a legend list (counts) beside it. More than 7 slices fold into "Other". */
export function DonutChart({ data, height = 200, centerLabel }: { data: { name: string; value: number }[]; height?: number; centerLabel?: string }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 7);
  const rest = sorted.slice(7).reduce((s, d) => s + d.value, 0);
  const slices = rest ? [...top, { name: 'Other', value: rest }] : top;
  const colors = slices.map((s, i) => (s.name === 'Other' && rest ? OTHER_GRAY : CATEGORICAL[i]));
  const total = slices.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" stroke={CHART.surface} strokeWidth={2} isAnimationActive={false}>
              {slices.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Pie>
            <Tooltip content={<TooltipBox />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-navy">{total}</span>
          {centerLabel && <span className="text-[11px] text-muted">{centerLabel}</span>}
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1 text-xs">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors[i] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-navy">{s.name}</span>
            <span className="font-semibold tabular-nums text-navy">{s.value}</span>
            <span className="w-9 text-right tabular-nums text-muted">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tiny inline sparkline for table rows (plain SVG — cheap to render hundreds). */
export function Sparkline({ values, color = '#1A6FC4', width = 72, height = 22, label }: { values: number[]; color?: string; width?: number; height?: number; label?: string }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (width - 6) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [3 + i * step, height - 3 - (v / max) * (height - 6)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} role="img" aria-label={label ?? `Trend: ${values.join(', ')}`} className="overflow-visible">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#B9C7DA" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />}
    </svg>
  );
}
