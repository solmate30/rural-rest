import * as React from "react";
import { useEffect, useState } from "react";
import { authClient } from "~/lib/auth.client";
import { cn } from "~/lib/utils";
import { useToast } from "~/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useLocation, useNavigate } from "react-router";
import { useKyc } from "./KycProvider";
import { useTranslation } from "react-i18next";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

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
    const { disconnect, connected, publicKey } = useWallet();
    const { setVisible: setWalletVisible } = useWalletModal();
    const { t, i18n } = useTranslation("common");

    const userRole = (session?.user as Record<string, unknown>)?.role as string | undefined;
    const isAdmin = userRole === "admin";
    const isHost = userRole === "spv";
    const isOperator = userRole === "operator";

    const handleSignOut = async () => {
        await disconnect().catch(() => {});
        await authClient.signOut();
        toast({ title: t("nav.logoutSuccess"), variant: "success" });
        setTimeout(() => { window.location.href = "/"; }, 500);
    };

    const handleLangToggle = async () => {
        const next = i18n.language === "ko" ? "en" : "ko";
        await i18n.changeLanguage(next);
        fetch("/api/set-language", {
            method: "POST",
            body: JSON.stringify({ locale: next }),
            headers: { "Content-Type": "application/json" },
        }).catch(() => {});
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
                {/* 로고 */}
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/'}>
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-white font-bold">R</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-primary">Rural Rest</span>
                </div>

                {/* 우측: 네비 + 유저 */}
                <div className="flex items-center gap-5">
                    <nav className="hidden md:flex items-center gap-5">
                        {isAdmin ? (
                            <>
                                <a href="/operator" className="text-sm font-medium hover:text-primary transition-colors">{t("nav.operatorDashboard")}</a>
                                <a href="/admin" className="text-sm font-medium hover:text-primary transition-colors">{t("nav.adminDashboard")}</a>
                                <a href="/governance" className="text-sm font-medium hover:text-primary transition-colors">{t("nav.governance")}</a>
                            </>
                        ) : isOperator || isHost ? (
                            <>
                                <a href="/operator" className="text-sm font-medium hover:text-primary transition-colors">{t("nav.operatorDashboard")}</a>
                                <a href="/governance" className="text-sm font-medium hover:text-primary transition-colors">{t("nav.governance")}</a>
                            </>
                        ) : (
                            <>
                                <a href="/" className="text-sm font-medium hover:text-primary transition-colors">{t("nav.findStay")}</a>
                                <a href="/invest" className="text-sm font-medium hover:text-primary transition-colors">{t("nav.invest")}</a>
                                <a href="/governance" className="text-sm font-medium hover:text-primary transition-colors">{t("nav.governance")}</a>
                            </>
                        )}
                    </nav>

                    {/* 언어 스위처 */}
                    {mounted && (
                        <button
                            onClick={handleLangToggle}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="언어 변경"
                        >
                            {i18n.language === "ko" ? "EN" : "한국어"}
                        </button>
                    )}

                    {/* 유저 영역 */}
                    {mounted && !isPending && (
                        !session ? (
                            <Button variant="outline" className="h-9 text-sm" onClick={() => navigate(`/auth?return=${location.pathname}`)}>
                                {t("nav.login")}
                            </Button>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-1.5 rounded-full p-0.5 hover:ring-2 hover:ring-primary/30 transition-all outline-none">
                                        <div className="relative">
                                        {session.user.image ? (
                                            <img src={session.user.image} alt={session.user.name} className="h-9 w-9 rounded-full object-cover border border-stone-200" />
                                        ) : (
                                            <div className={`h-9 w-9 rounded-full flex items-center justify-center border ${isAdmin ? "bg-amber-500/10 border-amber-300" : "bg-primary/10 border-primary/20"}`}>
                                                <span className={`text-xs font-bold ${isAdmin ? "text-amber-600" : "text-primary"}`}>
                                                    {isAdmin ? "A" : session.user.name?.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        {connected && (
                                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#17cf54] border-2 border-white" />
                                        )}
                                        </div>
                                        <svg className="w-3 h-3 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel className="font-normal">
                                        <p className="text-sm font-semibold">{isAdmin ? t("nav.admin") : session.user.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {/* 지갑 */}
                                    {connected && publicKey ? (
                                        <DropdownMenuItem
                                            className="cursor-pointer justify-between"
                                            onClick={() => disconnect()}
                                        >
                                            <span className="font-mono text-xs text-stone-600">
                                                {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
                                            </span>
                                            <span className="text-[11px] text-stone-400 ml-2">{t("nav.disconnectWallet")}</span>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            className="cursor-pointer text-stone-500"
                                            onClick={() => setWalletVisible(true)}
                                        >
                                            {t("nav.connectWallet")}
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    {/* 역할별 메뉴 */}
                                    {(isOperator || isAdmin) && (
                                        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/operator")}>
                                            {t("nav.operatorDashboard")}
                                        </DropdownMenuItem>
                                    )}
                                    {isAdmin && (
                                        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/admin")}>
                                            {t("nav.adminDashboard")}
                                        </DropdownMenuItem>
                                    )}
                                    {!isOperator && !isKycCompleted && (
                                        <DropdownMenuItem
                                            className="text-amber-600 focus:text-amber-600 focus:bg-amber-50 cursor-pointer"
                                            onClick={() => navigate(`/kyc?return=${location.pathname}`)}
                                        >
                                            {t("nav.verifyKyc")}
                                        </DropdownMenuItem>
                                    )}
                                    {!isOperator && !isAdmin && (
                                        <>
                                            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/my-bookings")}>
                                                {t("nav.myBookings")}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/my-investments")}>
                                                {t("nav.myPortfolio")}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="cursor-pointer text-muted-foreground focus:text-foreground" onClick={handleSignOut}>
                                        {t("nav.logout")}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    )}
                </div>
            </div>
        </header>
    );
}

export function Footer() {
    const { t } = useTranslation("common");
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
                            {t("footer.tagline")} <br />
                            {t("footer.taglineSub")} <br />
                            {t("footer.taglineSub2")}
                        </p>
                    </div>

                    {/* Discovery Column */}
                    <div>
                        <h4 className="font-bold text-stone-900 mb-4 tracking-tight">Search</h4>
                        <ul className="space-y-3 text-sm text-stone-500">
                            <li><a href="/" className="hover:text-primary transition-colors">{t("footer.links.findStay")}</a></li>
                            <li><a href="/" className="hover:text-primary transition-colors">Near Seoul</a></li>
                            <li><a href="/" className="hover:text-primary transition-colors">Near Busan</a></li>
                            <li><a href="/" className="hover:text-primary transition-colors">Gyeongju Stays</a></li>
                        </ul>
                    </div>

                    {/* Hosting Column */}
                    <div>
                        <h4 className="font-bold text-stone-900 mb-4 tracking-tight">Hosting</h4>
                        <ul className="space-y-3 text-sm text-stone-500">
                            <li><a href="/host" className="hover:text-primary transition-colors">{t("footer.links.hostHome")}</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Why Host?</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Hosting Policy</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Community Stories</a></li>
                        </ul>
                    </div>

                    {/* Support Column */}
                    <div>
                        <h4 className="font-bold text-stone-900 mb-4 tracking-tight">Support</h4>
                        <ul className="space-y-3 text-sm text-stone-500">
                            <li><a href="#" className="hover:text-primary transition-colors">{t("footer.links.helpCenter")}</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">{t("footer.links.safetyInfo")}</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Cancellation Options</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Contact Us</a></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-stone-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center justify-center gap-6 text-[13px] text-stone-400 font-medium">
                        <span>© 2026 {t("footer.copyright")}</span>
                        <a href="#" className="hover:text-stone-600 transition-colors underline-offset-4 hover:underline">{t("footer.links.privacy")}</a>
                        <a href="#" className="hover:text-stone-600 transition-colors underline-offset-4 hover:underline">{t("footer.links.terms")}</a>
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
