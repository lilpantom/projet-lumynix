import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts'
import { usePrefs } from '../../context/PreferencesContext'

/** Single-series line chart themed through CSS variables (works in both themes). */
export function TrendChart({ data, dataKey, label, unit, color = 'var(--series-1)', height = 140, domain }: { data: Record<string, number>[]; dataKey: string; label: string; unit?: string; color?: string; height?: number; domain?: [number | 'auto', number | 'auto'] }) {
  const { dt, num, dir } = usePrefs()
  return (
    <figure className="chart" aria-label={label}>
      <figcaption>{label}</figcaption>
      <div style={{ height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="t" tickFormatter={(v: number) => dt(v).replace(' UTC', '').split(' ').slice(-1)[0]} stroke="var(--muted)" fontSize={11} minTickGap={40} reversed={dir === 'rtl'} />
            <YAxis stroke="var(--muted)" fontSize={11} width={44} domain={domain ?? ['auto', 'auto']} tickFormatter={(v: number) => num(v)} orientation={dir === 'rtl' ? 'right' : 'left'} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', borderRadius: 6, color: 'var(--text)' }}
              labelFormatter={(v) => dt(Number(v))}
              formatter={(v) => [`${num(Number(v), 1)}${unit ? ` ${unit}` : ''}`, label]}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export function BarsChart({ data, dataKey, label, height = 120, color = 'var(--series-2)', xKey = 'x' }: { data: Record<string, number | string>[]; dataKey: string; label: string; height?: number; color?: string; xKey?: string }) {
  const { num, dir } = usePrefs()
  return (
    <figure className="chart" aria-label={label}>
      <figcaption>{label}</figcaption>
      <div style={{ height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey={xKey} stroke="var(--muted)" fontSize={11} reversed={dir === 'rtl'} />
            <YAxis stroke="var(--muted)" fontSize={11} width={36} tickFormatter={(v: number) => num(v)} orientation={dir === 'rtl' ? 'right' : 'left'} />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)', borderRadius: 6, color: 'var(--text)' }} formatter={(v) => [num(Number(v), 1), label]} cursor={{ fill: 'var(--accent-dim)' }} />
            <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
