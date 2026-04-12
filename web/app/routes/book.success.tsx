import { redirect } from "react-router";
import { Link, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/book.success";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { Header, Footer, Button, Card } from "~/components/ui-mockup";
import { dbDateToLocalStr } from "~/lib/date-utils";

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const bookingId = url.searchParams.get("booking_id");

    if (!bookingId) throw redirect("/");

    const [booking] = await db
        .select({
            id: bookings.id,
            guestId: bookings.guestId,
            status: bookings.status,
            totalPrice: bookings.totalPrice,
            checkIn: bookings.checkIn,
            checkOut: bookings.checkOut,
            listingId: bookings.listingId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

    if (!booking || booking.guestId !== user.id) throw redirect("/");

    return {
        booking: {
            id: booking.id,
            totalPrice: booking.totalPrice,
            checkIn: dbDateToLocalStr(booking.checkIn),
            checkOut: dbDateToLocalStr(booking.checkOut),
            listingId: booking.listingId,
        },
        pending: booking.status === "pending",
    };
}

export default function BookSuccess() {
    const { booking, pending } = useLoaderData<typeof loader>();
    const { t } = useTranslation("book");

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />
            <main className="container mx-auto py-12 px-4 max-w-2xl">
                <div className={`${pending ? "bg-amber-50" : "bg-primary/5"} rounded-3xl p-8 md:p-12 text-center space-y-6`}>
                    <div className={`mx-auto w-16 h-16 rounded-full ${pending ? "bg-amber-100" : "bg-primary/10"} flex items-center justify-center`}>
                        {pending ? (
                            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                            </svg>
                        ) : (
                            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                        {pending ? t("confirm.pendingTitle") : t("confirm.title")}
                    </h1>
                    <p className="text-muted-foreground">
                        {pending ? t("confirm.pendingMessage") : t("confirm.message")}
                    </p>
                    <Card className="p-6 text-left space-y-3 mx-auto max-w-md text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("confirm.bookingId")}</span>
                            <span className="font-mono text-xs">{booking.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("confirm.checkin")}</span>
                            <span className="font-medium">{booking.checkIn}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("confirm.checkout")}</span>
                            <span className="font-medium">{booking.checkOut}</span>
                        </div>
                        <div className="flex justify-between border-t pt-3">
                            <span className="font-bold">{t("confirm.total")}</span>
                            <span className="font-bold">₩{booking.totalPrice.toLocaleString()}</span>
                        </div>
                    </Card>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link to="/my/bookings">
                            <Button className="w-full sm:w-auto px-8">{t("confirm.myBookings")}</Button>
                        </Link>
                        <Link to={`/property/${booking.listingId}`}>
                            <Button variant="outline" className="w-full sm:w-auto px-8">{t("confirm.viewProperty")}</Button>
                        </Link>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
