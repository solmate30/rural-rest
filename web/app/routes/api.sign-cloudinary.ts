import type { Route } from "./+types/api.sign-cloudinary";
import { requireUser } from "~/lib/auth.server";
import { generateSignedParams } from "~/lib/cloudinary.server";
import { db } from "~/db/index.server";
import { listings } from "~/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/sign-cloudinary
 * Body: { type: "listing" | "avatar", listingId?: string }
 *
 * Listing 이미지: spv/operator/admin만 접근 가능
 *   - operator: 자신이 담당하는 listingId만 서명 가능
 *   - spv/admin: 모든 listingId 서명 가능
 * Avatar: 모든 로그인 사용자
 */
export async function action({ request }: Route.ActionArgs) {
    const user = await requireUser(request);
    const role = (user as any).role as string;

    const body = await request.json();
    const { type, listingId } = body as {
        type: "listing" | "avatar";
        listingId?: string;
    };

    let folder: string;

    switch (type) {
        case "listing": {
            if (!["spv", "operator", "admin"].includes(role)) {
                return new Response("Forbidden", { status: 403 });
            }
            if (!listingId) {
                return Response.json({ error: "listingId is required" }, { status: 400 });
            }

            // operator는 자신이 담당하는 매물만 업로드 가능
            if (role === "operator") {
                const [listing] = await db
                    .select({ hostId: listings.hostId })
                    .from(listings)
                    .where(eq(listings.id, listingId));

                if (!listing || listing.hostId !== user.id) {
                    return new Response("Forbidden", { status: 403 });
                }
            }

            folder = `rural-rest/listings/${listingId}`;
            break;
        }
        case "avatar": {
            folder = `rural-rest/users/${user.id}`;
            break;
        }
        default:
            return Response.json({ error: "Invalid type" }, { status: 400 });
    }

    const params = generateSignedParams(folder);
    return Response.json(params);
}
