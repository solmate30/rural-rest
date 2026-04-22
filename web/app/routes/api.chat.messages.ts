import { data } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { messages, bookings, listings, user as userTable } from "~/db/schema";
import { translateText } from "~/lib/translation.server";
import type { Route } from "./+types/api.chat.messages";

/* ------------------------------------------------------------------ */
/*  GET /api/chat/messages?bookingId=xxx                               */
/* ------------------------------------------------------------------ */

export async function loader({ request }: Route.LoaderArgs) {
    const currentUser = await requireUser(request);

    const url = new URL(request.url);
    const bookingId = url.searchParams.get("bookingId");

    if (!bookingId) {
        return data({ error: "bookingId is required" }, { status: 400 });
    }

    // Verify caller is guest or host of this booking
    const booking = await db
        .select({
            id: bookings.id,
            guestId: bookings.guestId,
            hostId: listings.hostId,
        })
        .from(bookings)
        .innerJoin(listings, eq(bookings.listingId, listings.id))
        .where(eq(bookings.id, bookingId))
        .get();

    if (!booking) {
        return data({ error: "Booking not found" }, { status: 404 });
    }

    if (currentUser.id !== booking.guestId && currentUser.id !== booking.hostId) {
        return data({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db
        .select({
            id: messages.id,
            senderId: messages.senderId,
            originalContent: messages.originalContent,
            translatedContent: messages.translatedContent,
            isTranslationSuccess: messages.isTranslationSuccess,
            createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.bookingId, bookingId))
        .orderBy(asc(messages.createdAt));

    return data({ messages: rows, currentUserId: currentUser.id });
}

/* ------------------------------------------------------------------ */
/*  POST /api/chat/messages                                            */
/*  Body: { bookingId: string; content: string }                       */
/* ------------------------------------------------------------------ */

export async function action({ request }: Route.ActionArgs) {
    if (request.method !== "POST") {
        return data({ error: "Method not allowed" }, { status: 405 });
    }

    const currentUser = await requireUser(request);
    const body = await request.json() as { bookingId?: string; content?: string };

    const { bookingId, content } = body;

    if (!bookingId || !content?.trim()) {
        return data({ error: "bookingId and content are required" }, { status: 400 });
    }

    // Fetch booking + host preferredLang + guest preferredLang
    const booking = await db
        .select({
            id: bookings.id,
            guestId: bookings.guestId,
            listingId: bookings.listingId,
            hostId: listings.hostId,
        })
        .from(bookings)
        .innerJoin(listings, eq(bookings.listingId, listings.id))
        .where(eq(bookings.id, bookingId))
        .get();

    if (!booking) {
        return data({ error: "Booking not found" }, { status: 404 });
    }

    if (currentUser.id !== booking.guestId && currentUser.id !== booking.hostId) {
        return data({ error: "Forbidden" }, { status: 403 });
    }

    // Determine receiver
    const receiverId = currentUser.id === booking.guestId ? booking.hostId : booking.guestId;

    const receiver = await db
        .select({ preferredLang: userTable.preferredLang })
        .from(userTable)
        .where(eq(userTable.id, receiverId))
        .get();

    const targetLang = receiver?.preferredLang ?? "en";

    // Translate
    const { translated, success } = await translateText(content.trim(), targetLang);

    // Save
    const messageId = uuidv4();
    const now = new Date();

    await db.insert(messages).values({
        id: messageId,
        bookingId,
        senderId: currentUser.id,
        originalContent: content.trim(),
        translatedContent: success ? translated : null,
        isTranslationSuccess: success,
        createdAt: now,
    });

    const saved = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .get();

    return data({ message: saved });
}
