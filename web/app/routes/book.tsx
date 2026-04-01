import { useState } from "react";
import { Form, useNavigation, Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/book";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { listings, rwaTokens } from "~/db/schema";
import { eq } from "drizzle-orm";
import { fetchPropertyOnchain } from "~/lib/rwa.onchain.server";


function toCityLabel(location: string): string {
    const m = location.match(/([가-힣]+)시/);
    return m ? `${m[1]} 근처` : location;
}

async function getListingById(id: string | undefined) {
    if (!id) return null;
    const row = await db
        .select({
            id: listings.id,
            title: listings.title,
            location: listings.location,
            pricePerNight: listings.pricePerNight,
            maxGuests: listings.maxGuests,
            images: listings.images,
            tokenStatus: rwaTokens.status,
        })
        .from(listings)
        .leftJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
        .where(eq(listings.id, id))
        .then((rows) => rows[0] ?? null);

    if (!row) return null;

    // 온체인 상태가 진실 — DB는 fallback
    if (row.tokenStatus) {
        const onchain = await fetchPropertyOnchain(id);
        if (onchain) {
            row.tokenStatus = onchain.status as typeof row.tokenStatus;
        }
    }

    // RWA 토큰이 있으면 active 상태일 때만 예약 가능
    if (row.tokenStatus && row.tokenStatus !== "active") return null;
    const images = row.images as string[];
    return {
        id: row.id,
        title: row.title,
        pricePerNight: row.pricePerNight,
        maxGuests: row.maxGuests,
        image: images[0] ?? "/house.png",
        locationLabel: toCityLabel(row.location),
        rating: null as number | null,
        reviews: [] as { id: string }[],
        pickupPoints: [] as { id: string; name: string; description: string; estimatedTimeToProperty: string }[],
    };
}
import { Header, Footer, Button, Card } from "~/components/ui-mockup";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const listing = await getListingById(params.id);
  if (!listing) throw new Response("Not Found", { status: 404 });
  return { listing, user: { name: user.name, email: user.email } };
}

export async function action({ params, request }: Route.ActionArgs) {
  await requireUser(request);
  const listing = await getListingById(params.id);
  if (!listing) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const checkIn = formData.get("checkIn") as string;
  const checkOut = formData.get("checkOut") as string;
  const guests = Number(formData.get("guests"));

  if (!checkIn || !checkOut || !guests) {
    return { success: false as const, error: "error.required" };
  }
  if (new Date(checkIn) >= new Date(checkOut)) {
    return { success: false as const, error: "error.checkoutBeforeCheckin" };
  }
  if (new Date(checkIn) < new Date(new Date().toDateString())) {
    return { success: false as const, error: "error.pastDate" };
  }
  if (guests > listing.maxGuests) {
    return { success: false as const, error: "error.guestLimit", max: listing.maxGuests };
  }

  const nights = Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalPrice = listing.pricePerNight * nights;

  return {
    success: true as const,
    booking: {
      id: crypto.randomUUID(),
      checkIn,
      checkOut,
      guests,
      nights,
      totalPrice,
      listingTitle: listing.title,
      status: "pending" as const,
    },
  };
}

export default function Book({ loaderData, actionData }: Route.ComponentProps) {
  const { listing, user } = loaderData;
  const { t } = useTranslation("book");
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const today = new Date().toISOString().split("T")[0];
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);

  const nights =
    checkIn && checkOut
      ? Math.max(
          0,
          Math.ceil(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;
  const subtotal = listing.pricePerNight * nights;

  // Confirmation UI
  if (actionData?.success === true) {
    const { booking } = actionData;
    return (
      <div className="min-h-screen bg-background font-sans">
        <Header />
        <main className="container mx-auto py-12 px-4 max-w-2xl">
          <div className="bg-primary/5 rounded-3xl p-8 md:p-12 text-center space-y-6">
            {/* Check icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {t("confirm.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("confirm.message")}
            </p>

            {/* Booking details */}
            <Card className="p-6 text-left space-y-4 mx-auto max-w-md">
              <h3 className="font-bold text-lg">{booking.listingTitle}</h3>
              <div className="space-y-3 text-sm">
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("confirm.guests")}</span>
                  <span className="font-medium">{t("confirm.guestsCount", { count: booking.guests })}</span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="font-bold">{t("confirm.total")}</span>
                  <span className="font-bold">₩{booking.totalPrice.toLocaleString()}</span>
                </div>
              </div>
            </Card>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link to="/">
                <Button className="w-full sm:w-auto px-8">{t("confirm.backHome")}</Button>
              </Link>
              <Link to={`/property/${listing.id}`}>
                <Button variant="outline" className="w-full sm:w-auto px-8">{t("confirm.viewProperty")}</Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Booking Form UI
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="container mx-auto py-8 md:py-12 px-4 sm:px-8 max-w-5xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-8 text-foreground">{t("title")}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Left Column: Form */}
          <div className="lg:col-span-3 space-y-8">
            {/* Error message */}
            {actionData?.success === false && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm font-medium">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(t as any)(actionData.error, { max: (actionData as { max?: number }).max })}
              </div>
            )}

            <Form method="post">
              {/* Your Trip Section */}
              <section className="space-y-6 mb-8">
                <h2 className="text-xl font-bold text-foreground">{t("section.trip")}</h2>
                <Card className="p-6 space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="checkIn" className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                      {t("field.checkin")}
                    </label>
                    <input
                      type="date"
                      id="checkIn"
                      name="checkIn"
                      min={today}
                      value={checkIn}
                      onChange={(e) => {
                        setCheckIn(e.target.value);
                        if (checkOut && e.target.value >= checkOut) setCheckOut("");
                      }}
                      className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="checkOut" className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                      {t("field.checkout")}
                    </label>
                    <input
                      type="date"
                      id="checkOut"
                      name="checkOut"
                      min={checkIn || today}
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="guests" className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                      {t("field.guests")}
                    </label>
                    <select
                      id="guests"
                      name="guests"
                      value={guests}
                      onChange={(e) => setGuests(Number(e.target.value))}
                      className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none cursor-pointer"
                      required
                    >
                      {Array.from({ length: listing.maxGuests }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}명
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-stone-400">{t("field.maxGuests", { max: listing.maxGuests })}</p>
                  </div>
                </Card>
              </section>

              {/* Transport Concierge Section */}
              {listing.pickupPoints.length > 0 && (
                <section className="space-y-4 mb-8">
                  <h2 className="text-xl font-bold text-foreground">{t("section.transport")}</h2>

                  {/* Free shuttle banner */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h.01M16 17h.01M3 11l1-6h16l1 6M3 11h18M3 11v6a1 1 0 001 1h1m14-7v6a1 1 0 01-1 1h-1m-10 0h8" />
                    </svg>
                    <p className="text-sm text-stone-600">
                      <span className="font-bold text-primary">{t("field.shuttleFree")}</span> &mdash; {t("field.shuttleDesc")}
                    </p>
                  </div>

                  {/* Pickup points */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {listing.pickupPoints.map((point) => (
                      <div
                        key={point.id}
                        className="flex items-start gap-3 p-4 rounded-xl bg-stone-50 border border-stone-100"
                      >
                        <div className="mt-0.5 p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
                          <svg className="w-4 h-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-stone-800">{point.name}</p>
                          <p className="text-xs text-stone-500 mt-0.5">{point.description}</p>
                          <p className="text-xs text-primary font-semibold mt-1.5">
                            {t("field.travelTime", { time: point.estimatedTimeToProperty })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 text-xl font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? t("submitting") : t("submit")}
              </Button>
              <p className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-3">
                {t("noCharge")}
              </p>
            </Form>
          </div>

          {/* Right Column: Booking Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-6">
                <Card className="p-6 md:p-8 shadow-2xl border-none bg-white rounded-3xl">
              {/* Listing info */}
              <div className="flex gap-4 mb-6">
                <div className="h-20 w-20 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                  <img src={listing.image} className="w-full h-full object-cover" alt={listing.title} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{listing.locationLabel}</p>
                  <p className="font-bold text-foreground truncate">{listing.title}</p>
                  <p className="text-xs font-medium mt-1">
                    ★ {listing.rating} ({listing.reviews.length} reviews)
                  </p>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="border-t pt-6 space-y-4 text-sm font-medium">
                <div className="flex justify-between text-stone-600">
                  <span>
                    ₩{listing.pricePerNight.toLocaleString()} x {nights > 0 ? nights : "—"} night{nights !== 1 ? "s" : ""}
                  </span>
                  <span className="font-bold">
                    {nights > 0 ? `₩${subtotal.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-stone-600">
                  <div className="flex items-center gap-1">
                    <span>{t("price.concierge")}</span>
                    <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-primary font-bold">{t("price.conciergePrice")}</span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-5 text-xl font-bold text-stone-900">
                  <span>{t("price.total")}</span>
                  <span>{nights > 0 ? `₩${subtotal.toLocaleString()}` : "—"}</span>
                </div>
              </div>
            </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
