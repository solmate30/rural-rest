/**
 * privy-hooks.ts — Privy 기반 클라이언트 인증 훅
 *
 * auth.client.ts에서 이름 변경 (.client. 접미사는 React Router가 서버 번들에서 제외하므로 SSR 에러 발생)
 */
import { usePrivy, useLogout, useLoginWithEmail, useLoginWithOAuth } from "@privy-io/react-auth";
import { useEffect, useState, useCallback } from "react";

export { usePrivy, useLogout, useLoginWithEmail, useLoginWithOAuth };

export type DbUser = {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: "guest" | "spv" | "operator" | "admin";
    preferredLang: string;
    walletAddress: string | null;
    kycVerified: boolean;
    privyDid: string | null;
};

type SessionData = { user: DbUser } | null;

/**
 * useSession — Better Auth useSession과 동일한 인터페이스
 * Privy 인증 상태 + /api/user/me에서 DB user 정보를 합쳐 반환
 */
export function useSession(): { data: SessionData; isPending: boolean } {
    const { ready, authenticated } = usePrivy();
    const [data, setData] = useState<SessionData>(null);
    const [isPending, setIsPending] = useState(true);

    const fetchUser = useCallback(async () => {
        try {
            const res = await fetch("/api/user/me");
            if (res.ok) {
                const user = await res.json();
                setData({ user });
            } else {
                setData(null);
            }
        } catch {
            setData(null);
        } finally {
            setIsPending(false);
        }
    }, []);

    useEffect(() => {
        if (!ready) return;
        if (!authenticated) {
            setData(null);
            setIsPending(false);
            return;
        }
        fetchUser();
    }, [ready, authenticated, fetchUser]);

    return { data, isPending };
}

/**
 * signOut — 쿠키 삭제 + Privy 로그아웃
 */
export async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = "/auth";
}
