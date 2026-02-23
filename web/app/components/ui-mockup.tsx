import * as React from "react";
import { useEffect, useState } from "react";
import { authClient } from "~/lib/auth.client";
import { cn } from "~/lib/utils";
import { useToast } from "~/hooks/use-toast";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useLocation, useNavigate } from "react-router";
import { useKyc } from "./KycProvider";

export function Button({
    className,
    variant = "primary",
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "outline" | "ghost";
}) {
    return (
        <button
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-10 px-6 py-2 active:scale-95",
                // Global Radius 12px applied here via rounded-xl or var(--radius)
                "rounded-[var(--radius)]",
                variant === "primary" && "bg-primary text-primary-foreground shadow hover:bg-primary/90",
                variant === "outline" && "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
                variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
                className
            )}
            {...props}
        />
    );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "bg-card text-card-foreground shadow-sm border border-border",
                "rounded-[calc(var(--radius)*2)]", // Cards slightly more rounded
                className
            )}
            {...props}
        />
    );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn(
                "flex h-10 w-full bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border border-input",
                "rounded-[var(--radius)]",
                className
            )}
            {...props}
        />
    );
}

export function Badge({
    className,
    variant = "default",
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "outline" | "secondary";
}) {
    return (
        <div
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                variant === "default" && "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
                variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                variant === "outline" && "text-foreground border-border hover:bg-accent/50 cursor-pointer",
                className
            )}
            {...props}
        />
    );
}

export function Slider({
    className,
    min = 0,
    max = 100,
    value,
    onChange,
    ...props
}: {
    className?: string;
    min?: number;
    max?: number;
    value: number;
    onChange: (val: number) => void;
}) {
    return (
        <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-primary"
                {...props}
            />
        </div>
    );
}

export function Header() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const sessionRes = authClient?.useSession();
    const session = sessionRes?.data;
    const isPending = sessionRes?.isPending || false;
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const { isKycCompleted } = useKyc();
    const isInvestRoute = location.pathname.startsWith('/invest') || location.pathname.startsWith('/my-investments');

    const handleSignOut = async () => {
        await authClient.signOut();
        toast({
            title: "로그아웃되었습니다",
            description: "다음에 또 만나요!",
            variant: "success",
        });
        // Toast가 표시된 후 페이지 이동
        setTimeout(() => {
            window.location.href = "/";
        }, 500);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/'}>
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-white font-bold">R</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-primary">Rural Rest</span>
                </div>
                <nav className="hidden md:flex items-center gap-6">
                    <a href="/" className="text-sm font-medium hover:text-primary transition-colors">Find a Stay</a>
                    <a href="/admin" className="text-sm font-medium hover:text-primary transition-colors">Host your Home</a>
                    <a href="/invest" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">Invest (RWA)</a>
                    {isInvestRoute && (
                        <a href="/my-investments" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">My Portfolio</a>
                    )}

                    {/* Conditional Auth Rendering */}
                    {isInvestRoute ? (
                        mounted && (
                            <div className="ml-2 pl-6 border-l border-border h-10 flex items-center">
                                {isKycCompleted ? (
                                    <WalletMultiButton className="!bg-[#17cf54] !text-white !border-none hover:!bg-[#14b847] !shadow-sm !rounded-[var(--radius)] !h-10 !px-6 !py-2 !text-sm !font-medium transition-colors" />
                                ) : (
                                    <Button
                                        variant="outline"
                                        className="h-10 text-xs font-bold gap-1 text-stone-500 hover:text-stone-700 hover:border-stone-400 border-dashed"
                                        onClick={() => session ? navigate("/kyc") : navigate("/auth")}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">lock</span>
                                        실명 인증 필요
                                    </Button>
                                )}
                            </div>
                        )
                    ) : (
                        mounted && !isPending && (
                            session ? (
                                <div className="flex items-center gap-4 ml-4">
                                    <div className="flex items-center gap-2.5">
                                        {session.user.image ? (
                                            <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-white ring-1 ring-stone-200 shadow-sm">
                                                <img
                                                    src={session.user.image}
                                                    alt={session.user.name}
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center border-2 border-white ring-1 ring-primary/20 shadow-sm">
                                                <span className="text-xs font-bold text-primary">
                                                    {session.user.name?.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        <span className="text-sm font-semibold text-foreground/80">{session.user.name}님</span>
                                    </div>
                                    <Button variant="outline" onClick={handleSignOut} className="h-9 px-4 text-xs font-bold">로그아웃</Button>
                                </div>
                            ) : (
                                <Button variant="outline" className="ml-4" onClick={() => window.location.href = '/auth'}>Login</Button>
                            )
                        )
                    )}
                </nav>
            </div>
        </header>
    );
}

export function Footer() {
    return (
        <footer className="bg-stone-50 border-t border-stone-200 pt-16 pb-8">
            <div className="container mx-auto px-4 sm:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
                                <span className="text-white text-xs font-bold">R</span>
                            </div>
                            <span className="text-lg font-bold tracking-tight text-primary">Rural Rest</span>
                        </div>
                        <p className="text-stone-500 text-sm leading-relaxed max-w-xs transition-opacity hover:opacity-80">
                            비어있던 집, 다시 숨을 쉬다. <br />
                            한국의 시골 빈집을 정성껏 고쳐 <br />
                            당신만의 특별한 휴식처를 제공합니다.
                        </p>
                    </div>

                    {/* Discovery Column */}
                    <div>
                        <h4 className="font-bold text-stone-900 mb-4 tracking-tight">Search</h4>
                        <ul className="space-y-3 text-sm text-stone-500">
                            <li><a href="/" className="hover:text-primary transition-colors">Find a Stay</a></li>
                            <li><a href="/" className="hover:text-primary transition-colors">Near Seoul</a></li>
                            <li><a href="/" className="hover:text-primary transition-colors">Near Busan</a></li>
                            <li><a href="/" className="hover:text-primary transition-colors">Gyeongju Stays</a></li>
                        </ul>
                    </div>

                    {/* Hosting Column */}
                    <div>
                        <h4 className="font-bold text-stone-900 mb-4 tracking-tight">Hosting</h4>
                        <ul className="space-y-3 text-sm text-stone-500">
                            <li><a href="/admin" className="hover:text-primary transition-colors">Host your Home</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Why Host?</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Hosting Policy</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Community Stories</a></li>
                        </ul>
                    </div>

                    {/* Support Column */}
                    <div>
                        <h4 className="font-bold text-stone-900 mb-4 tracking-tight">Support</h4>
                        <ul className="space-y-3 text-sm text-stone-500">
                            <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Safety Info</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Cancellation Options</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Contact Us</a></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-stone-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center justify-center gap-6 text-[13px] text-stone-400 font-medium">
                        <span>© 2026 Rural Rest Inc.</span>
                        <a href="#" className="hover:text-stone-600 transition-colors underline-offset-4 hover:underline">Privacy</a>
                        <a href="#" className="hover:text-stone-600 transition-colors underline-offset-4 hover:underline">Terms</a>
                        <a href="#" className="hover:text-stone-600 transition-colors underline-offset-4 hover:underline">Sitemap</a>
                    </div>
                    <div className="flex items-center gap-5">
                        <a href="#" className="text-stone-400 hover:text-stone-600 transition-colors">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                        </a>
                        <a href="#" className="text-stone-400 hover:text-stone-600 transition-colors">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
