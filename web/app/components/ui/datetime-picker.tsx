import * as React from "react";
import { DayPicker } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

interface Props {
    value: string;           // "YYYY-MM-DDTHH:mm"
    onChange: (v: string) => void;
    min?: string;
    max?: string;
    className?: string;
}

function parseLocal(s: string): { date: Date | undefined; hour: string; minute: string } {
    if (!s) return { date: undefined, hour: "07", minute: "00" };
    const [datePart, timePart] = s.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = (timePart ?? "07:00").split(":");
    return { date: new Date(y, m - 1, d), hour: hh ?? "07", minute: mm ?? "00" };
}

function toDatetimeStr(date: Date, hour: string, minute: string): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}T${hour}:${minute}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function DateTimePicker({ value, onChange, min, className }: Props) {
    const [open, setOpen] = React.useState(false);
    const { date, hour, minute } = parseLocal(value);

    function handleDaySelect(day: Date | undefined) {
        if (!day) return;
        onChange(toDatetimeStr(day, hour, minute));
        setOpen(false);
    }

    function handleHour(h: string) {
        if (!date) return;
        onChange(toDatetimeStr(date, h, minute));
    }

    function handleMinute(m: string) {
        if (!date) return;
        onChange(toDatetimeStr(date, hour, m));
    }

    const minDate = min ? parseLocal(min).date : undefined;

    const displayStr = date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}  ${hour}:${minute}`
        : "Select date & time";

    return (
        <div className={cn("flex gap-2 items-center", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="flex-1 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30 hover:border-stone-300"
                    >
                        {displayStr}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <DayPicker
                        mode="single"
                        selected={date}
                        onSelect={handleDaySelect}
                        disabled={minDate ? { before: minDate } : undefined}
                        classNames={{
                            root: "p-3",
                            month_caption: "flex justify-center items-center font-semibold text-sm mb-2",
                            nav: "flex items-center justify-between mb-1",
                            button_previous: "p-1 rounded hover:bg-stone-100",
                            button_next: "p-1 rounded hover:bg-stone-100",
                            weeks: "mt-1",
                            weekdays: "flex",
                            weekday: "w-8 text-center text-xs text-stone-400 font-medium",
                            week: "flex",
                            day: "w-8 h-8 text-center text-sm",
                            day_button: "w-8 h-8 rounded-lg hover:bg-stone-100 text-sm",
                            selected: "[&>button]:bg-[#17cf54] [&>button]:text-white [&>button]:hover:bg-[#14b847]",
                            today: "[&>button]:font-bold [&>button]:border [&>button]:border-stone-300",
                            disabled: "[&>button]:opacity-30 [&>button]:cursor-not-allowed",
                        }}
                    />
                </PopoverContent>
            </Popover>

            {/* Hour dropdown */}
            <select
                value={hour}
                onChange={(e) => handleHour(e.target.value)}
                className="border border-stone-200 rounded-xl px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30 w-16"
            >
                {HOURS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                ))}
            </select>

            <span className="text-stone-400 text-sm">:</span>

            {/* Minute dropdown */}
            <select
                value={minute}
                onChange={(e) => handleMinute(e.target.value)}
                className="border border-stone-200 rounded-xl px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30 w-16"
            >
                {MINUTES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                ))}
            </select>
        </div>
    );
}
