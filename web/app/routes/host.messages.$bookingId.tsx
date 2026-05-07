import { useState, useEffect, useRef } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { data } from "react-router";
import { eq, asc } from "drizzle-orm";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, listings, messages, user as userTable } from "~/db/schema";
import { cn } from "~/lib/utils";
import { Header, Footer } from "~/components/ui-mockup";
import type { Route } from "./+types/host.messages.$bookingId";

export async function loader({ request, params }: Route.LoaderArgs) {
    const currentUser = await requireUser(request, ["admin", "operator", "spv"]);
    const { bookingId } = params;

    const booking = await db
        .select({
            id: bookings.id,
            checkIn: bookings.checkIn,
            checkOut: bookings.checkOut,
            guestId: bookings.guestId,
            listingId: bookings.listingId,
            listingTitle: listings.title,
            hostId: listings.hostId,
        })
        .from(bookings)
        .innerJoin(listings, eq(bookings.listingId, listings.id))
        .where(eq(bookings.id, bookingId))
        .get();

    if (!booking) throw data("Booking not found", { status: 404 });

    if (currentUser.id !== booking.hostId && !["admin", "operator", "spv"].includes(currentUser.role)) {
        throw data("Forbidden", { status: 403 });
    }

    const partnerId = booking.guestId;
    const partner = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, partnerId))
        .get();

    const initialMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.bookingId, bookingId))
        .orderBy(asc(messages.createdAt));

    return {
        booking,
        partnerName: partner?.name ?? "게스트",
        initialMessages,
        currentUserId: currentUser.id,
    };
}

interface ChatMessage {
    id: string;
    senderId: string;
    originalContent: string;
    translatedContent: string | null;
    isTranslationSuccess: boolean;
    createdAt: Date | null;
}

export default function HostMessagesPage() {
    const { booking, partnerName, initialMessages, currentUserId } = useLoaderData<typeof loader>();
    const navigate = useNavigate();

    const [msgs, setMsgs] = useState<ChatMessage[]>(initialMessages as ChatMessage[]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [expandedOriginal, setExpandedOriginal] = useState<Set<string>>(new Set());
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        const id = setInterval(async () => {
            const res = await fetch(`/api/chat/messages?bookingId=${booking.id}`);
            if (!res.ok) return;
            const data = await res.json();
            setMsgs(prev => {
                const existingIds = new Set(prev.map((m) => m.id));
                const next = (data.messages as ChatMessage[]).filter((m) => !existingIds.has(m.id));
                return next.length > 0 ? [...prev, ...next] : prev;
            });
        }, 3000);
        return () => clearInterval(id);
    }, [booking.id]);

    async function handleSend() {
        const text = input.trim();
        if (!text || sending) return;
        setSending(true);
        setInput("");
        try {
            const res = await fetch("/api/chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: booking.id, content: text }),
            });
            if (res.ok) {
                const json = await res.json() as { message: ChatMessage };
                setMsgs((prev) => [...prev, json.message]);
            }
        } catch (e) {
            console.error("[chat] send failed", e);
            setInput(text);
        } finally {
            setSending(false);
        }
    }

    function toggleOriginal(id: string) {
        setExpandedOriginal((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function fmtDate(d: Date | null) {
        if (!d) return "";
        return new Intl.DateTimeFormat("ko", { month: "long", day: "numeric" }).format(new Date(d));
    }

    function fmtTime(d: Date | null) {
        if (!d) return "";
        return new Intl.DateTimeFormat("default", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
    }

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans flex flex-col">
            <Header />
            <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-3xl w-full flex flex-col">
            <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
            <div className="flex items-center gap-3 mb-4">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-stone-100 transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px] text-stone-400">arrow_back</span>
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-[#4a3b2c] truncate">{booking.listingTitle}</h2>
                    <p className="text-xs text-stone-400">
                        {fmtDate(booking.checkIn)} — {fmtDate(booking.checkOut)} · {partnerName}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-stone-400 bg-stone-100 px-2.5 py-1 rounded-full">
                    <span className="material-symbols-outlined text-[12px]">translate</span>
                    자동 번역
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white rounded-3xl border border-stone-100 shadow-sm px-5 py-5 space-y-4">
                {msgs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                        <span className="material-symbols-outlined text-stone-200 text-[40px]">chat_bubble_outline</span>
                        <p className="text-sm font-medium text-stone-300">첫 메시지를 보내보세요</p>
                        <p className="text-xs text-stone-200">메시지는 상대방 언어로 자동 번역됩니다</p>
                    </div>
                )}

                {msgs.map((m) => {
                    const isMe = m.senderId === currentUserId;
                    const showOrig = expandedOriginal.has(m.id);
                    const displayText = isMe
                        ? m.originalContent
                        : (m.isTranslationSuccess && m.translatedContent ? m.translatedContent : m.originalContent);
                    const hasTranslation = !isMe && m.isTranslationSuccess && !!m.translatedContent;

                    return (
                        <div key={m.id} className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
                            <div
                                className={cn(
                                    "max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                    isMe
                                        ? "bg-[#17cf54] text-white rounded-br-sm"
                                        : "bg-stone-100 text-[#4a3b2c] rounded-bl-sm"
                                )}
                            >
                                {displayText}
                            </div>

                            <div className={cn("flex items-center gap-2 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
                                <span className="text-[11px] text-stone-300 tabular-nums">{fmtTime(m.createdAt)}</span>
                                {hasTranslation && (
                                    <button
                                        onClick={() => toggleOriginal(m.id)}
                                        className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2"
                                    >
                                        {showOrig ? "원문 숨기기" : "원문 보기"}
                                    </button>
                                )}
                            </div>

                            {showOrig && hasTranslation && (
                                <div className="max-w-[72%] rounded-xl px-3.5 py-2.5 text-xs text-stone-400 italic bg-stone-50 border border-stone-100 leading-relaxed">
                                    {m.originalContent}
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            <div className="mt-3 flex items-center gap-3 bg-white rounded-2xl border border-stone-100 shadow-sm px-4 py-3">
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSend();
                        }
                    }}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 text-sm bg-transparent outline-none text-[#4a3b2c] placeholder:text-stone-300"
                />
                <button
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || sending}
                    className="shrink-0 w-9 h-9 rounded-xl bg-[#17cf54] hover:bg-[#13b347] disabled:bg-stone-100 flex items-center justify-center transition-all"
                >
                    {sending
                        ? <span className="material-symbols-outlined text-white text-[16px] animate-spin">progress_activity</span>
                        : <span className="material-symbols-outlined text-white text-[16px]">send</span>
                    }
                </button>
            </div>
            </div>
            </main>
            <Footer />
        </div>
    );
}
