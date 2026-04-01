import { Header, Button, Input, Card, Footer } from "../components/ui-mockup";
import { signIn, signUp } from "../lib/auth.client";
import { getSession } from "../lib/auth.server";
import { redirect } from "react-router";
import type { Route } from "./+types/auth";
import { useState } from "react";
import { useToast } from "../hooks/use-toast";
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation("auth");

    const handleGoogleSignIn = async () => {
        try {
            await signIn.social({
                provider: "google",
                callbackURL: "/",
            });
        } catch (error) {
            toast({
                title: t("toast.socialError"),
                description: t("toast.socialErrorDesc"),
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
                title: t("toast.socialError"),
                description: t("toast.socialErrorDesc"),
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
                        title: t("toast.loginError"),
                        description: signInError.message || t("toast.loginErrorDesc"),
                        variant: "destructive",
                    });
                } else if (data?.user) {
                    toast({
                        title: t("toast.loginSuccess"),
                        description: t("toast.loginSuccessDesc", { name: data.user.name }),
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
                        title: t("toast.signupError"),
                        description: signUpError.message || t("toast.signupErrorDesc"),
                        variant: "destructive",
                    });
                } else if (data?.user) {
                    toast({
                        title: t("toast.signupSuccess"),
                        description: t("toast.signupSuccessDesc"),
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
                title: t("toast.unknownError"),
                description: t("toast.unknownErrorDesc"),
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
                        {t("tagline1")} <br />
                        <span className="text-primary font-bold">{t("tagline2")}</span>
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        {t("taglineDesc")}
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="font-medium text-foreground/80">{t("feature")}</span>
                    </div>
                </div>

                <Card className="w-full max-w-md p-8 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border-none bg-white">
                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{isLogin ? t("loginTitle") : t("signupTitle")}</h1>
                        <p className="text-muted-foreground">
                            {isLogin ? t("loginDesc") : t("signupDesc")}
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
                            {t("kakaoLogin")}
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full h-14 rounded-xl text-md font-semibold transition-all active:scale-95 flex items-center justify-center gap-3"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                            {t("googleLogin")}
                        </Button>
                    </div>

                    <div className="relative my-10">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-muted" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-4 text-muted-foreground font-medium tracking-widest">{t("or")}</span>
                        </div>
                    </div>

                    <form className="space-y-4" onSubmit={handleAuthSubmit}>
                        {!isLogin && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground/70 uppercase tracking-widest ml-1">{t("name")}</label>
                                <Input
                                    type="text"
                                    placeholder={t("namePlaceholder")}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="h-12 border-muted hover:border-primary focus:border-primary transition-all rounded-xl"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground/70 uppercase tracking-widest ml-1">{t("email")}</label>
                            <Input
                                type="email"
                                placeholder={t("emailPlaceholder")}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-12 border-muted hover:border-primary focus:border-primary transition-all rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground/70 uppercase tracking-widest ml-1">{t("password")}</label>
                            <Input
                                type="password"
                                placeholder={t("passwordPlaceholder")}
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
                            {isLoading ? t("submitting") : (isLogin ? t("submitLogin") : t("submitSignup"))}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground mt-8">
                        {isLogin ? t("toggleToSignup") : t("toggleToLogin")}
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-primary font-bold hover:underline ml-2"
                        >
                            {isLogin ? t("switchToSignup") : t("switchToLogin")}
                        </button>
                    </p>
                </Card>
            </main>
            <Footer />
        </div>
    );
}
