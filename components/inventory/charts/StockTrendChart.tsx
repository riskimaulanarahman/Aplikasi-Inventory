'use client';

import type { AnalyticsPeriod } from '@/components/inventory/types';
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';

interface TrendDataPoint {
	key: string;
	label: string;
	inQty: number;
	outQty: number;
	netQty: number;
}

interface StockTrendChartProps {
	trendData: TrendDataPoint[];
	period: AnalyticsPeriod;
}

export default function StockTrendChart({
	trendData,
	period,
}: StockTrendChartProps) {
	return (
		<ResponsiveContainer width="100%" height="100%">
			<ComposedChart
				data={trendData}
				margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
			>
				<CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
				<XAxis
					dataKey="label"
					tick={{ fontSize: 10 }}
					minTickGap={period === 'last30days' ? 22 : 14}
				/>
				<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
				<Tooltip
					contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
					formatter={(value: number | string | undefined, name: string | undefined) => [
						`${Number(value ?? 0)} unit`,
						name ?? '-',
					]}
				/>
				<Legend />
				<Bar
					dataKey="inQty"
					name="Masuk"
					fill="#10b981"
					radius={[6, 6, 0, 0]}
					animationDuration={650}
				/>
				<Bar
					dataKey="outQty"
					name="Keluar"
					fill="#f97316"
					radius={[6, 6, 0, 0]}
					animationDuration={700}
				/>
				<Line
					type="monotone"
					dataKey="netQty"
					name="Net"
					stroke="#7c3aed"
					strokeWidth={2.5}
					dot={period === 'yearly'}
					animationDuration={900}
				/>
			</ComposedChart>
		</ResponsiveContainer>
	);
}
