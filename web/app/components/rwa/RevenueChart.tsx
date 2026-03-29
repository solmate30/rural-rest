import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface ChartEntry {
    month: string;
    dividend: number;
    cumulative: number;
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const monthly = payload.find((p: any) => p.dataKey === "dividend");
    const cumul = payload.find((p: any) => p.dataKey === "cumulative");
    return (
        <div className="bg-[#2c1f14] text-white text-xs px-3 py-2.5 rounded-xl shadow-2xl min-w-[148px]">
            <p className="text-white/50 mb-2 font-medium">{label}</p>
            {monthly && (
                <div className="flex justify-between gap-4">
                    <span className="text-white/60">Monthly</span>
                    <span className="font-bold text-[#17cf54]">{monthly.value.toFixed(1)} USDC</span>
                </div>
            )}
            {cumul && (
                <div className="flex justify-between gap-4 mt-1">
                    <span className="text-white/60">Cumulative</span>
                    <span className="font-bold text-[#ab9ff2]">{cumul.value.toFixed(1)} USDC</span>
                </div>
            )}
        </div>
    );
}

interface Props {
    apy: number;
    chartData: ChartEntry[];
    isActual?: boolean;
}

export function RevenueChart({ apy, chartData, isActual = false }: Props) {
    const annualTotal = chartData.reduce((sum, d) => sum + d.dividend, 0);

    return (
        <div className="rounded-3xl bg-white border border-stone-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-5 flex items-start justify-between">
                <div>
                    <p className="text-xs text-stone-400 font-medium">
                        {isActual ? "Annual Dividend (Actual)" : "Est. Annual Dividend"}
                    </p>
                    <p className="text-3xl font-bold text-[#4a3b2c] mt-0.5">
                        {annualTotal.toFixed(1)}
                        <span className="text-base font-normal text-stone-400 ml-1.5">USDC / 1,000 tokens</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-stone-400 font-medium">Est. APY</p>
                    <p className="text-3xl font-bold text-[#17cf54] mt-0.5">+{apy}%</p>
                </div>
            </div>

            <div className="h-[200px] px-4">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 0, right: 10, left: -28, bottom: 0 }} barSize={18}>
                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#a8a29e", fontSize: 11 }}
                            dy={8}
                        />
                        <YAxis yAxisId="bar" axisLine={false} tickLine={false} tick={{ fill: "#a8a29e", fontSize: 11 }} />
                        <YAxis yAxisId="line" orientation="right" axisLine={false} tickLine={false} tick={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(23, 207, 84, 0.06)" }} />
                        <Bar yAxisId="bar" dataKey="dividend" fill="#17cf54" radius={[4, 4, 0, 0]} opacity={0.85} />
                        <Line yAxisId="line" type="monotone" dataKey="cumulative" stroke="#ab9ff2" strokeWidth={2.5} dot={{ r: 3, fill: "#ab9ff2", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="flex justify-center items-center gap-6 px-6 py-4 border-t border-stone-100">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-[#17cf54] opacity-85" />
                    <span className="text-xs text-stone-500">Monthly</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ab9ff2]" />
                    <span className="text-xs text-stone-500">Cumulative</span>
                </div>
                {!isActual && (
                    <span className="text-xs text-stone-400 ml-2">* Projected</span>
                )}
            </div>
        </div>
    );
}
