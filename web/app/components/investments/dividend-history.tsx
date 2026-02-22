import { ExternalLink, Download } from "lucide-react";

interface DividendRecord {
    id: string;
    date: string;
    propertyName: string;
    amount: number;
    txHash: string;
    status: "Completed" | "Pending";
}

interface DividendHistoryProps {
    records: DividendRecord[];
}

export function DividendHistory({ records }: DividendHistoryProps) {
    return (
        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-[#4a3b2c]">Dividend History</h2>
                <button className="flex items-center gap-2 text-sm font-medium text-[#4a3b2c] hover:text-[#17cf54] px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors">
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-stone-50/50 text-stone-500 text-sm font-medium border-b border-stone-100">
                            <th className="py-4 px-6 font-normal">Date</th>
                            <th className="py-4 px-6 font-normal">Property</th>
                            <th className="py-4 px-6 font-normal text-right">Amount (USDC)</th>
                            <th className="py-4 px-6 font-normal text-center">Status</th>
                            <th className="py-4 px-6 font-normal">Transaction</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {records.map((record) => (
                            <tr key={record.id} className="hover:bg-stone-50/50 transition-colors">
                                <td className="py-4 px-6 text-sm text-stone-600">{record.date}</td>
                                <td className="py-4 px-6 text-sm font-medium text-[#4a3b2c]">{record.propertyName}</td>
                                <td className="py-4 px-6 text-sm font-medium text-[#4a3b2c] text-right">
                                    {record.amount.toLocaleString()} USDC
                                </td>
                                <td className="py-4 px-6 text-center">
                                    <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${record.status === "Completed"
                                                ? "bg-green-50 text-green-700"
                                                : "bg-amber-50 text-amber-700"
                                            }`}
                                    >
                                        {record.status}
                                    </span>
                                </td>
                                <td className="py-4 px-6">
                                    {record.txHash ? (
                                        <a
                                            href={`https://explorer.solana.com/tx/${record.txHash}?cluster=devnet`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm text-[#17cf54] hover:underline"
                                        >
                                            {record.txHash.substring(0, 6)}...{record.txHash.substring(record.txHash.length - 4)}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    ) : (
                                        <span className="text-sm text-stone-400">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-stone-500">
                                    No dividend records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
