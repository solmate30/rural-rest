import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Line,
    ComposedChart,
} from "recharts";

const DUMMY_DIVIDENDS = [3200, 3000, 3900, 3500, 4500, 4200, 5200, 4900, 4400, 5400, 5100, 4100];
const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const chartData = MONTHS.map((month, index) => {
    const netDividend = DUMMY_DIVIDENDS[index];
    const platformFee = Math.round(netDividend * 0.05);
    const operatingCost = Math.round(netDividend * 0.15);
    const grossRevenue = netDividend + operatingCost + platformFee;
    const cumulativeDividend = DUMMY_DIVIDENDS.slice(0, index + 1).reduce((a, b) => a + b, 0);
    return { month, netDividend, platformFee, operatingCost, grossRevenue, cumulativeDividend };
});

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
        <div className="bg-stone-900 text-white text-xs px-3 py-2 rounded-lg shadow-2xl z-10 min-w-[160px]">
            <div className="font-bold text-sm mb-2 border-b border-white/20 pb-1">{label} 배당 상세</div>
            <div className="space-y-1">
                <div className="flex justify-between">
                    <span className="text-white/70">총 수익</span>
                    <span className="font-semibold">₩{data.grossRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-white/70">운영비</span>
                    <span className="text-red-300">-₩{data.operatingCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-white/70">플랫폼 수수료</span>
                    <span className="text-red-300">-₩{data.platformFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 mt-1 border-t border-white/20">
                    <span className="font-bold text-[#17cf54]">순 배당</span>
                    <span className="font-bold text-[#17cf54]">₩{data.netDividend.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1">
                    <span className="font-bold text-amber-400">누적 배당</span>
                    <span className="font-bold text-amber-400">₩{data.cumulativeDividend.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

interface Props {
    lastDividend: string;
    apy: number;
}

export function RevenueChart({ lastDividend, apy }: Props) {
    const annualTotal = DUMMY_DIVIDENDS.reduce((a, b) => a + b, 0);

    return (
        <div className="p-6 rounded-3xl bg-white border border-stone-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <p className="text-sm text-stone-500 font-medium mb-1">연간 합계 (token당)</p>
                    <p className="text-3xl font-bold text-[#4a3b2c]">
                        {annualTotal.toLocaleString()}
                        <span className="text-lg font-normal text-stone-400 ml-1">USDC</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-stone-500 font-medium mb-1">연 수익률 (est.)</p>
                    <p className="text-3xl font-bold text-[#17cf54]">+{apy}%</p>
                </div>
            </div>

            <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 12 }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(23, 207, 84, 0.05)' }} />
                        <Bar yAxisId="left" dataKey="netDividend" fill="#17cf54" radius={[4, 4, 0, 0]} barSize={32} opacity={0.8} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativeDividend" stroke="#ab9ff2" strokeWidth={3} dot={{ r: 4, fill: "#ab9ff2", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="flex justify-center items-center gap-6 mt-6 pt-4 border-t border-stone-100">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#17cf54] opacity-80" />
                    <span className="text-xs text-stone-500">월별 순 배당</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ab9ff2]" />
                    <span className="text-xs text-stone-500">누적 배당</span>
                </div>
            </div>
            <p className="text-xs text-stone-400 text-center mt-4">Last Dividend — {lastDividend}</p>
        </div>
    );
}
