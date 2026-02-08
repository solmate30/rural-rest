import type { Route } from "./+types/api.sign-cloudinary";
import { requireUser } from "~/lib/auth.server";
import { generateSignedParams } from "~/lib/cloudinary.server";

/**
 * POST /api/sign-cloudinary
 * Body: { type: "listing" | "avatar", listingId?: string }
 *
 * Listing 이미지: host/admin만 접근 가능
 * Avatar: 모든 로그인 사용자 접근 가능
 */
export async function action({ request }: Route.ActionArgs) {
    const user = await requireUser(request);

    const body = await request.json();
    const { type, listingId } = body as {
        type: "listing" | "avatar";
        listingId?: string;
    };

    let folder: string;
    let preset: string | undefined;

    switch (type) {
        case "listing": {
            // 호스트/관리자만 리스팅 이미지 업로드 가능
            if (!["host", "admin"].includes((user as any).role)) {
                return new Response("Forbidden", { status: 403 });
            }
            if (!listingId) {
                return Response.json(
                    { error: "listingId is required" },
                    { status: 400 }
                );
            }
            folder = `rural-rest-v2/listings/${listingId}`;
            preset = "listing_preset";
            break;
        }
        case "avatar": {
            folder = `rural-rest-v2/users/${user.id}`;
            preset = "avatar_preset";
            break;
        }
        default:
            return Response.json(
                { error: "Invalid type" },
                { status: 400 }
            );
    }

    const params = generateSignedParams(folder, preset);
    return Response.json(params);
}
