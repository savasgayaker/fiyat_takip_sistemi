import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

/** Tiny inline sparkline for item price history. */
export function Sparkline({
  data,
  color = "hsl(var(--primary))",
  height = 40,
}: {
  data: { fiyat: number }[];
  color?: string;
  height?: number;
}) {
  if (!data?.length) return null;
  const vals = data.map((d) => d.fiyat);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
        <YAxis hide domain={[Math.min(...vals), Math.max(...vals)]} />
        <Line
          type="monotone"
          dataKey="fiyat"
          stroke={color}
          strokeWidth={1.6}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
