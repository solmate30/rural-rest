import { useState, useEffect } from "react";

interface Props {
    deadlineMs: number; // Unix ms
}

function getTimeLeft(deadlineMs: number) {
    const diff = deadlineMs - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { days, hours, minutes, seconds };
}

export function FundingCountdown({ deadlineMs }: Props) {
    const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(deadlineMs));

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(getTimeLeft(deadlineMs));
        }, 1000);
        return () => clearInterval(timer);
    }, [deadlineMs]);

    if (!timeLeft) {
        return (
            <div className="px-4 py-3 bg-stone-100 rounded-2xl text-center">
                <p className="text-sm font-bold text-stone-400">Funding period ended</p>
            </div>
        );
    }

    const units = [
        { label: "Days", value: timeLeft.days },
        { label: "Hrs", value: timeLeft.hours },
        { label: "Min", value: timeLeft.minutes },
        { label: "Sec", value: timeLeft.seconds },
    ];

    return (
        <div className="rounded-2xl bg-[#2c1f14] px-5 py-4">
            <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-3">
                Funding Ends In
            </p>
            <div className="grid grid-cols-4 gap-3">
                {units.map(({ label, value }, i) => (
                    <div key={label} className="text-center relative">
                        {i < 3 && (
                            <span className="absolute -right-2 top-0 text-xl font-bold text-white/20 select-none">:</span>
                        )}
                        <span className="text-3xl font-bold text-white tabular-nums leading-none">
                            {String(value).padStart(2, "0")}
                        </span>
                        <p className="text-[10px] text-white/30 font-medium mt-1.5 uppercase tracking-wide">{label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
