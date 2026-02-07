import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

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
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-white font-bold">R</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-foreground">Rural Rest</span>
                </div>
                <nav className="hidden md:flex items-center gap-6">
                    <a href="/" className="text-sm font-medium hover:text-primary transition-colors">Find a Stay</a>
                    <a href="/admin" className="text-sm font-medium hover:text-primary transition-colors">Host your Home</a>
                    <Button variant="outline" className="ml-4" onClick={() => window.location.href = '/auth'}>Login</Button>
                </nav>
            </div>
        </header>
    );
}
