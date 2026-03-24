import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

export function InvestmentUpsellCard({ listingId }: { listingId: string }) {
    return (
        <div className="p-6 rounded-3xl bg-[#faf9f6] border border-[#f0ede6] shadow-md">
            <h3 className="text-xl font-bold text-[#4a3b2c] leading-snug mb-4">
                이 따스한 공간의<br />
                공동 주인이 되어주세요
            </h3>

            <Link to={`/invest/${listingId}`}>
                <button className="w-full py-4 px-4 rounded-xl bg-[#4a3b2c] text-white text-sm font-bold shadow-sm hover:bg-[#3d3023] transition-colors flex items-center justify-center gap-2">
                    <span>이 집의 한 조각 소유하기</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
            </Link>
        </div>
    );
}
