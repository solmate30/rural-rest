import { Header, Button, Input, Card, Footer } from "../components/ui-mockup";
import { signIn, signUp } from "../lib/auth.client";
import { getSession } from "../lib/auth.server";
import { redirect } from "react-router";
import type { Route } from "./+types/auth";
import { useState } from "react";
import { useToast } from "../hooks/use-toast";

export async function loader({ request }: Route.LoaderArgs) {
    const session = await getSession(request);
    if (session) {
        return redirect("/");
    }
    return null;
}

export default function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleGoogleSignIn = async () => {
        try {
            await signIn.social({
                provider: "google",
                callbackURL: "/",
            });
        } catch (error) {
            toast({
                title: "소셜 로그인 실패",
                description: "소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
                variant: "destructive",
            });
        }
    };

    const handleKakaoSignIn = async () => {
        try {
            await signIn.social({
                provider: "kakao",
                callbackURL: "/",
            });
        } catch (error) {
            toast({
                title: "소셜 로그인 실패",
                description: "소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
                variant: "destructive",
            });
        }
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isLogin) {
                const { data, error: signInError } = await signIn.email({
                    email,
                    password,
                    callbackURL: "/",
                });
                if (signInError) {
                    toast({
                        title: "로그인 실패",
                        description: signInError.message || "이메일 또는 비밀번호가 올바르지 않습니다.",
                        variant: "destructive",
                    });
                } else if (data?.user) {
                    toast({
                        title: "로그인되었습니다",
                        description: `${data.user.name}님, 환영합니다!`,
                        variant: "success",
                    });
                    // Toast가 표시된 후 리다이렉트
                    setTimeout(() => {
                        window.location.href = "/";
                    }, 500);
                }
            } else {
                const { data, error: signUpError } = await signUp.email({
                    email,
                    password,
                    name,
                    callbackURL: "/",
                });
                if (signUpError) {
                    toast({
                        title: "회원가입 실패",
                        description: signUpError.message || "이미 가입된 이메일입니다.",
                        variant: "destructive",
                    });
                } else if (data?.user) {
                    toast({
                        title: "회원가입 완료",
                        description: "Rural Rest에 오신 것을 환영합니다!",
                        variant: "success",
                    });
                    // Toast가 표시된 후 리다이렉트
                    setTimeout(() => {
                        window.location.href = "/";
                    }, 500);
                }
            }
        } catch (err) {
            toast({
                title: "오류 발생",
                description: "알 수 없는 오류가 발생했습니다.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />
            <main className="container mx-auto flex flex-col md:flex-row items-center justify-center py-12 md:py-20 px-4 gap-12">
                {/* Brand Story Section */}
                <div className="flex-1 max-w-lg space-y-6 hidden md:block">
                    <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
                        비어있던 집, <br />
                        <span className="text-primary font-bold">당신의 휴식</span>이 되다.
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        도시의 소음에서 벗어나 남해의 정취를 느껴보세요.
                        마을의 이야기가 담긴 특별한 공간들이 당신을 기다립니다.
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="font-medium text-foreground/80">1초 만에 시작하는 원스톱 예약</span>
                    </div>
                </div>

                <Card className="w-full max-w-md p-8 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border-none bg-white">
                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{isLogin ? "로그인" : "회원가입"}</h1>
                        <p className="text-muted-foreground">
                            {isLogin ? "Rural Rest와 함께 특별한 여정을 시작하세요." : "지금 가입하고 마을의 이야기를 만나보세요."}
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* Social Logins */}
                        <Button
                            className="w-full h-14 bg-[#FEE500] hover:bg-[#FEE500]/90 text-black border-none rounded-xl text-md font-bold transition-all active:scale-95 flex items-center justify-center gap-3"
                            onClick={handleKakaoSignIn}
                            disabled={isLoading}
                        >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" alt="Kakao" className="w-6 h-6" />
                            카카오로 {isLogin ? "로그인" : "시작하기"}
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full h-14 rounded-xl text-md font-semibold transition-all active:scale-95 flex items-center justify-center gap-3"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                            Google로 {isLogin ? "로그인" : "시작하기"}
                        </Button>
                    </div>

                    <div className="relative my-10">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-muted" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-4 text-muted-foreground font-medium tracking-widest">OR</span>
                        </div>
                    </div>

                    <form className="space-y-4" onSubmit={handleAuthSubmit}>
                        {!isLogin && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground/70 uppercase tracking-widest ml-1">이름</label>
                                <Input
                                    type="text"
                                    placeholder="홍길동"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="h-12 border-muted hover:border-primary focus:border-primary transition-all rounded-xl"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground/70 uppercase tracking-widest ml-1">이메일</label>
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-12 border-muted hover:border-primary focus:border-primary transition-all rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground/70 uppercase tracking-widest ml-1">비밀번호</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-12 border-muted hover:border-primary focus:border-primary transition-all rounded-xl"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full h-14 text-lg font-bold mt-4 shadow-lg shadow-primary/20 rounded-xl"
                            disabled={isLoading}
                        >
                            {isLoading ? "처리 중..." : (isLogin ? "이메일로 로그인" : "회원가입 완료")}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground mt-8">
                        {isLogin ? "아직 계정이 없으신가요?" : "이미 계정이 있으신가요?"}
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-primary font-bold hover:underline ml-2"
                        >
                            {isLogin ? "회원가입" : "로그인"}
                        </button>
                    </p>
                </Card>
            </main>
            <Footer />
        </div>
    );
}
