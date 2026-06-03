import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

export default function EloSparkline({ data }) {
  if (!data || data.length < 2) return null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Evolución ATP</p>
        <span className="text-[10px] text-zinc-600 font-bold uppercase">{data.length} últimos eventos</span>
      </div>
      <div className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
            <Line type="monotone" dataKey="elo_after" stroke="#10b981" strokeWidth={3} dot={false} animationDuration={1000} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
