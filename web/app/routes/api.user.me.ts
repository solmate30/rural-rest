/**
 * api.user.me.ts — 현재 로그인된 DB user 반환
 * 클라이언트의 useSession() 훅이 호출
 */
import { getSession } from "../lib/privy.server";
import type { Route } from "./+types/api.user.me";

export async function loader({ request }: Route.LoaderArgs) {
    const session = await getSession(request);
    if (!session) {
        return Response.json(null, { status: 401 });
    }
    return Response.json(session.user);
}
