import * as React from "react";
import { authClient } from "~/lib/auth.client";
import { cn } from "~/lib/utils";
import { useToast } from "~/hooks/use-toast";

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

export function Header() {
    const sessionRes = authClient?.useSession();
    const session = sessionRes?.data;
    const isPending = sessionRes?.isPending || false;
    const { toast } = useToast();

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
                    {!isPending && (
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
                    )}
                </nav>
            </div>
        </header>
    );
}
