import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { MessageCircle, X, Send, User, Bot, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

export function AiConcierge() {
    const { t } = useTranslation("concierge");
    const location = useLocation();
    // invest/:id 페이지는 하단에 MobileInvestBar가 있어서 FAB을 위로 올림 (lg 이상에서는 bar가 없으므로 원위치)
    const hasMobileBar = /^\/invest\/[^/]+/.test(location.pathname);
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append("content", input);
            if (threadId) formData.append("threadId", threadId);

            const response = await fetch("/api/chat/concierge", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Failed to send message");

            const data = await response.json();
            setThreadId(data.threadId);

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.response,
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: t("errorMsg"),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("fixed right-6 z-50 flex flex-col items-end", hasMobileBar ? "bottom-24 lg:bottom-6" : "bottom-6")}>
            {/* Chat Window */}
            {isOpen && (
                <Card className="mb-4 w-[350px] sm:w-[400px] h-[550px] shadow-2xl flex flex-col overflow-hidden border-none animate-in slide-in-from-bottom-5 duration-300">
                    {/* Header */}
                    <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                <Bot className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Rural Rest Concierge</h3>
                                <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">Always here to help</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10 rounded-full" onClick={() => setIsOpen(false)}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Messages Area */}
                    <ScrollArea className="flex-1 p-4 bg-stone-50" ref={scrollRef}>
                        <div className="space-y-4">
                            {messages.length === 0 && (
                                <div className="py-8 text-center space-y-3">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                                        <Bot className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-stone-800">{t("greeting")}</p>
                                        <p className="text-xs text-stone-500">{t("greetingDesc")}</p>
                                    </div>
                                </div>
                            )}
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex gap-3 max-w-[85%]",
                                        msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                    )}
                                >
                                    <Avatar className="w-8 h-8 border shadow-sm">
                                        {msg.role === "assistant" ? (
                                            <AvatarImage src="" />
                                        ) : (
                                            <AvatarImage src="" />
                                        )}
                                        <AvatarFallback className={msg.role === "assistant" ? "bg-primary text-primary-foreground text-[10px]" : "bg-stone-200 text-stone-600 text-[10px]"}>
                                            {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div
                                        className={cn(
                                            "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                                            msg.role === "user"
                                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                                : "bg-white text-stone-800 border border-stone-100 rounded-tl-none"
                                        )}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-3 mr-auto">
                                    <Avatar className="w-8 h-8 border shadow-sm">
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                            <Bot className="w-4 h-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="bg-white border border-stone-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span className="text-xs text-stone-400 font-medium italic">Thinking...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-stone-100">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                            className="flex gap-2"
                        >
                            <Input
                                placeholder={t("placeholder")}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="flex-1 rounded-xl border-stone-200 focus-visible:ring-primary h-11"
                            />
                            <Button type="submit" size="icon" className="h-11 w-11 rounded-xl shadow-lg shadow-primary/20" disabled={isLoading}>
                                <Send className="w-5 h-5" />
                            </Button>
                        </form>
                    </div>
                </Card>
            )}

            {/* Floating Button */}
            {!isOpen && (
                <Button
                    size="icon"
                    className="h-14 w-14 rounded-full shadow-2xl shadow-primary/40 animate-in zoom-in-50 duration-300"
                    onClick={() => setIsOpen(true)}
                >
                    <MessageCircle className="w-7 h-7" />
                </Button>
            )}
        </div>
    );
}
