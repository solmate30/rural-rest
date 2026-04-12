import { useState } from "react";
import { Form, useNavigation, Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import type { Route } from "./+types/book";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { listings, rwaTokens, bookings } from "~/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { fetchPropertyOnchain } from "~/lib/rwa.onchain.server";
import { throttledSync } from "~/lib/rwa.server";
import { PYTH_USD_KRW_FEED, KRW_PER_USDC_FALLBACK } from "~/lib/constants";
import { parseLocalDate, parseLocalDateToUnix, toLocalDateStr } from "~/lib/date-utils";
import { Header, Footer, Button, Card } from "~/components/ui-mockup";
import { useKyc } from "~/components/KycProvider";
import { usePythRate } from "~/hooks/usePythRate";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { ko as koLocale, enUS } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "~/lib/utils";

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

    if (row.tokenStatus) {
        const onchain = await fetchPropertyOnchain(id);
        if (onchain) {
            row.tokenStatus = onchain.status as typeof row.tokenStatus;
        }
    }

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

export async function loader({ params, request }: Route.LoaderArgs) {
  await throttledSync().catch(() => {});
  const user = await requireUser(request);
  const listing = await getListingById(params.id);
  if (!listing) throw new Response("Not Found", { status: 404 });

  const bookedRanges = await db
    .select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
    .from(bookings)
    .where(
      and(
        eq(bookings.listingId, listing.id),
        eq(bookings.status, "confirmed"),
      )
    );

  return { listing, user: { id: user.id, name: user.name, email: user.email }, bookedRanges };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const listing = await getListingById(params.id);
  if (!listing) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const checkIn = formData.get("checkIn") as string;
  const checkOut = formData.get("checkOut") as string;
  const guests = Number(formData.get("guests"));

  if (!checkIn || !checkOut || !guests) {
    return { success: false as const, error: "error.required" };
  }
  if (parseLocalDate(checkIn) >= parseLocalDate(checkOut)) {
    return { success: false as const, error: "error.checkoutBeforeCheckin" };
  }
  if (parseLocalDate(checkIn) <= parseLocalDate(toLocalDateStr(new Date()))) {
    return { success: false as const, error: "error.pastDate" };
  }
  if (guests > listing.maxGuests) {
    return { success: false as const, error: "error.guestLimit", max: listing.maxGuests };
  }

  // 날짜 중복 예약 체크 (pending/confirmed 상태의 예약과 겹치는지 확인)
  // DB는 Unix timestamp(초) 저장 — ms → sec 변환 필수
  const checkInSec = parseLocalDateToUnix(checkIn);
  const checkOutSec = parseLocalDateToUnix(checkOut);
  const overlapping = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.listingId, listing.id),
        sql`${bookings.status} IN ('pending', 'confirmed')`,
        sql`${bookings.checkIn} < ${checkOutSec}`,
        sql`${bookings.checkOut} > ${checkInSec}`,
      )
    );
  if (overlapping.length > 0) {
    return { success: false as const, error: "error.dateConflict" };
  }

  const nights = Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalPrice = listing.pricePerNight * nights;
  // 미리보기용 USDC 환산 (fallback rate, 실제 온체인 금액은 Pyth로 계산)
  const previewUsdc = Math.round((totalPrice / KRW_PER_USDC_FALLBACK) * 1_000_000);

  const bookingId = crypto.randomUUID();

  // DB insert 없이 booking 데이터만 반환 — 실제 저장은 결제 완료 후 confirm 엔드포인트에서 처리
  return {
    success: true as const,
    booking: {
      id: bookingId,
      checkIn,
      checkOut,
      guests,
      nights,
      totalPrice,
      previewUsdc,
      listingTitle: listing.title,
      listingId: listing.id,
      guestId: user.id,
      status: "pending" as const,
    },
  };
}

// ──────────────────────────────────────────────
// 결제 단계 컴포넌트
// ──────────────────────────────────────────────
type BookingPayload = {
  id: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  totalPrice: number;
  previewUsdc: number;
  listingTitle: string;
  listingId: string;
  guestId: string;
};

// ──────────────────────────────────────────────
// PayPal 카드 결제 단계
// ──────────────────────────────────────────────
function CardPayStep({ booking }: { booking: BookingPayload }) {
  const { t, i18n } = useTranslation("book");
  const [err, setErr] = useState("");
  const [processing, setProcessing] = useState(false);
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "";
  const locale = i18n.language === "ko" ? "ko_KR" : "en_US";

  return (
    <div className="space-y-3">
      {err && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{err}</div>}
      {processing && (
        <p className="text-center text-sm text-stone-500">{t("submitting")}</p>
      )}
      <PayPalScriptProvider
        options={{ clientId, intent: "authorize", currency: "USD", locale }}
      >
        <PayPalButtons
          style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay" }}
          disabled={processing}
          createOrder={async () => {
            const res = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bookingId: booking.id, totalPrice: booking.totalPrice }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? t("payment.error"));
            return data.orderID;
          }}
          onApprove={async (data) => {
            setProcessing(true);
            setErr("");
            const res = await fetch("/api/paypal/capture-auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                bookingId: booking.id,
                orderID: data.orderID,
                listingId: booking.listingId,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                guests: booking.guests,
                totalPrice: booking.totalPrice,
              }),
            });
            if (!res.ok) {
              const errData = await res.json();
              setErr(errData.error ?? t("payment.error"));
              setProcessing(false);
              return;
            }
            window.location.href = `/book/success?booking_id=${booking.id}`;
          }}
          onError={(paypalErr) => {
            setErr(String(paypalErr));
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}

function PaymentStep({ booking, listingId }: { booking: BookingPayload; listingId: string }) {
  const { t } = useTranslation("book");
  const { connection } = useConnection();
  const wallet = usePrivyAnchorWallet();
  const { isKycCompleted } = useKyc();
  const [payMethod, setPayMethod] = useState<"card" | "usdc">("card");
  const [txState, setTxState] = useState<"idle" | "paying" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const { rate: pythRate, loading: rateLoading } = usePythRate();

  async function handlePay() {
    if (!wallet) {
      setErrorMsg("결제 준비가 아직 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setTxState("paying");
    setErrorMsg("");
    try {
      const { getProgram, deriveBookingEscrowPda, getUsdcMint, deriveBookingEscrowVault } = await import("~/lib/anchor-client");
      const { PublicKey, SystemProgram } = await import("@solana/web3.js");
      const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
      const { BN } = await import("@coral-xyz/anchor");

      const program = await getProgram(connection, wallet);
      const usdcMint = await getUsdcMint();
      const { pda: escrowPda } = await deriveBookingEscrowPda(booking.id);
      const escrowVault = await deriveBookingEscrowVault(escrowPda, usdcMint);
      const guestUsdc = getAssociatedTokenAddressSync(usdcMint, wallet.publicKey);
      const pythPriceFeed = new PublicKey(PYTH_USD_KRW_FEED);

      const checkInTs = parseLocalDateToUnix(booking.checkIn);
      const checkOutTs = parseLocalDateToUnix(booking.checkOut);

      // UUID 하이픈 제거 (36 → 32 bytes) — Solana seed 최대 길이 32 bytes 제한
      const bookingIdSeed = booking.id.replace(/-/g, "");
      const tx = await program.methods
        .createBookingEscrow(
          listingId,
          bookingIdSeed,
          new BN(booking.totalPrice),
          new BN(checkInTs),
          new BN(checkOutTs),
        )
        .accounts({
          guest: wallet.publicKey,
          bookingEscrow: escrowPda,
          escrowVault,
          guestUsdc,
          usdcMint,
          pythPriceFeed,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const confirmRes = await fetch("/api/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          escrowPda: escrowPda.toBase58(),
          txSignature: tx,
          amountUsdc: booking.previewUsdc,
          listingId: booking.listingId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guests: booking.guests,
          totalPrice: booking.totalPrice,
        }),
      });

      if (!confirmRes.ok) {
        const errData = await confirmRes.json();
        setErrorMsg(errData.error ?? t("payment.error"));
        setTxState("error");
        return;
      }

      window.location.href = `/book/success?booking_id=${booking.id}`;
    } catch (err: any) {
      const { parseAnchorError } = await import("~/lib/anchor-client");
      setErrorMsg(parseAnchorError(err));
      setTxState("error");
    }
  }

  const usdcDisplay = rateLoading
    ? "..."
    : (booking.totalPrice / pythRate).toFixed(2);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="container mx-auto py-12 px-4 max-w-2xl">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-foreground">{t("payment.title")}</h1>

          <Card className="p-6 space-y-4">
            <h2 className="font-bold text-lg">{booking.listingTitle}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{booking.checkIn} ~ {booking.checkOut}</span>
                <span>{t("payment.nightsGuests", { nights: booking.nights, guests: booking.guests })}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="font-bold">{t("payment.amount")}</span>
                <div className="text-right">
                  <p className="font-bold text-lg">₩{booking.totalPrice.toLocaleString()}</p>
                  {payMethod === "usdc" && (
                    <>
                      <p className="text-sm text-primary font-semibold">≈ {usdcDisplay} USDC</p>
                      <p className="text-xs text-muted-foreground">{t("payment.pythNote")}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* 결제 방법 선택 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPayMethod("card")}
              className={cn(
                "p-4 rounded-2xl border-2 text-left transition-all",
                payMethod === "card"
                  ? "border-primary bg-primary/5"
                  : "border-stone-200 hover:border-stone-300"
              )}
            >
              <p className="font-bold text-sm text-foreground">{t("payment.methodCard")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("payment.methodCardDesc")}</p>
            </button>
            <button
              type="button"
              onClick={() => setPayMethod("usdc")}
              className={cn(
                "p-4 rounded-2xl border-2 text-left transition-all",
                payMethod === "usdc"
                  ? "border-primary bg-primary/5"
                  : "border-stone-200 hover:border-stone-300"
              )}
            >
              <p className="font-bold text-sm text-foreground">{t("payment.methodUsdc")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("payment.methodUsdcDesc")}</p>
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{errorMsg}</div>
          )}

          {/* 카드 결제 (Stripe) */}
          {payMethod === "card" && <CardPayStep booking={booking} />}

          {/* USDC 결제 */}
          {payMethod === "usdc" && (
            !isKycCompleted ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">{t("payment.kycRequired")}</p>
                <Button
                  onClick={() => window.location.href = `/kyc?return=/property/${listingId}`}
                  className="w-full h-14 text-lg font-bold rounded-2xl"
                >
                  {t("payment.kycButton")}
                </Button>
              </div>
            ) : !wallet ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-stone-400 text-sm py-6">
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  결제 준비 중입니다. 잠시만 기다려주세요.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm bg-green-50 rounded-xl p-3">
                  <span className="text-green-700 font-medium">{t("payment.walletConnected")}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {wallet.publicKey.toBase58().slice(0, 6)}...{wallet.publicKey.toBase58().slice(-4)}
                  </span>
                </div>
                <Button
                  onClick={handlePay}
                  disabled={txState === "paying"}
                  className="w-full h-14 text-xl font-bold rounded-2xl shadow-xl shadow-primary/20"
                >
                  {txState === "paying" ? t("submitting") : t("payment.payButton", { usdc: usdcDisplay })}
                </Button>
              </div>
            )
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function Book({ loaderData, actionData }: Route.ComponentProps) {
  const { listing, bookedRanges } = loaderData;
  const { t } = useTranslation("book");
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { rate: pythRate, loading: rateLoading } = usePythRate();

  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const calLocale = i18n.language === "ko" ? koLocale : enUS;
  const [calCheckInOpen, setCalCheckInOpen] = useState(false);
  const [calCheckOutOpen, setCalCheckOutOpen] = useState(false);

  // URL 파라미터에서 초기 날짜 파싱 (YYYY-MM-DD 로컬 문자열)
  function parseDateParam(s: string | null): Date | undefined {
    if (!s) return undefined;
    const parts = s.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return undefined;
    return parseLocalDate(s);
  }

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = parseDateParam(searchParams.get("checkIn"));
    const to = parseDateParam(searchParams.get("checkOut"));
    return from ? { from, to } : undefined;
  });
  const [guests, setGuests] = useState(Number(searchParams.get("guests") ?? "1"));

  const checkIn = dateRange?.from ? toLocalDateStr(dateRange.from) : "";
  const checkOut = dateRange?.to ? toLocalDateStr(dateRange.to) : "";

  function formatDateLabel(d: Date) {
    return d.toLocaleDateString(i18n.language === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
  }

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

  // 결제 단계: booking 생성 완료 후 USDC 결제 UI
  if (actionData?.success === true) {
    return <PaymentStep booking={{ ...actionData.booking, listingId: listing.id }} listingId={listing.id} />;
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="container mx-auto py-8 md:py-12 px-4 sm:px-8 max-w-5xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-8 text-foreground">{t("title")}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          <div className="lg:col-span-3 space-y-8">
            {actionData?.success === false && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm font-medium">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(t as any)(actionData.error, { max: (actionData as { max?: number }).max })}
              </div>
            )}

            <Form method="post">
              <section className="space-y-6 mb-8">
                <h2 className="text-xl font-bold text-foreground">{t("section.trip")}</h2>
                <Card className="p-6 space-y-5">
                  {/* hidden inputs for form submission */}
                  <input type="hidden" name="checkIn" value={checkIn} />
                  <input type="hidden" name="checkOut" value={checkOut} />

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">{t("field.checkin")} / {t("field.checkout")}</p>
                    <div className="grid grid-cols-2 divide-x divide-stone-200 border border-stone-200 rounded-2xl overflow-hidden">
                      {/* 체크인 */}
                      <Popover open={calCheckInOpen} onOpenChange={setCalCheckInOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn("p-4 text-left hover:bg-primary/5 transition-colors", calCheckInOpen && "bg-primary/5")}
                          >
                            <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1">{t("field.checkin")}</p>
                            <p className={cn("text-sm font-semibold", dateRange?.from ? "text-stone-800" : "text-stone-400")}>
                              {dateRange?.from ? formatDateLabel(dateRange.from) : t("field.selectDate")}
                            </p>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 shadow-2xl" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange?.from}
                            onSelect={(day) => {
                              if (!day) return;
                              const newFrom = day;
                              const newTo = dateRange?.to && dateRange.to > day ? dateRange.to : undefined;
                              setDateRange({ from: newFrom, to: newTo });
                              setCalCheckInOpen(false);
                              if (!newTo) setCalCheckOutOpen(true);
                            }}
                            disabled={[
                              { before: new Date(new Date().setHours(24, 0, 0, 0)) },
                              ...bookedRanges.map((r) => ({ from: r.checkIn, to: r.checkOut })),
                            ]}
                            locale={calLocale}
                          />
                        </PopoverContent>
                      </Popover>
                      {/* 체크아웃 */}
                      <Popover open={calCheckOutOpen} onOpenChange={setCalCheckOutOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn("p-4 text-left hover:bg-primary/5 transition-colors", calCheckOutOpen && "bg-primary/5")}
                          >
                            <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1">{t("field.checkout")}</p>
                            <p className={cn("text-sm font-semibold", dateRange?.to ? "text-stone-800" : "text-stone-400")}>
                              {dateRange?.to ? formatDateLabel(dateRange.to) : t("field.selectDate")}
                            </p>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 shadow-2xl" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange?.to}
                            onSelect={(day) => {
                              if (!day) return;
                              setDateRange((prev) => ({ from: prev?.from, to: day }));
                              setCalCheckOutOpen(false);
                            }}
                            disabled={[
                              { before: dateRange?.from ? new Date(dateRange.from.getTime() + 86400000) : new Date(new Date().setHours(48, 0, 0, 0)) },
                              ...bookedRanges.map((r) => ({ from: r.checkIn, to: r.checkOut })),
                            ]}
                            locale={calLocale}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
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
                          {t("guestOption", { n: i + 1 })}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-stone-400">{t("field.maxGuests", { max: listing.maxGuests })}</p>
                  </div>
                </Card>
              </section>

              {listing.pickupPoints.length > 0 && (
                <section className="space-y-4 mb-8">
                  <h2 className="text-xl font-bold text-foreground">{t("section.transport")}</h2>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h.01M16 17h.01M3 11l1-6h16l1 6M3 11h18M3 11v6a1 1 0 001 1h1m14-7v6a1 1 0 01-1 1h-1m-10 0h8" />
                    </svg>
                    <p className="text-sm text-stone-600">
                      <span className="font-bold text-primary">{t("field.shuttleFree")}</span> &mdash; {t("field.shuttleDesc")}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {listing.pickupPoints.map((point) => (
                      <div key={point.id} className="flex items-start gap-3 p-4 rounded-xl bg-stone-50 border border-stone-100">
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

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 text-xl font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </Form>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-6">
              <Card className="p-6 md:p-8 shadow-2xl border-none bg-white rounded-3xl">
                <div className="flex gap-4 mb-6">
                  <div className="h-20 w-20 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                    <img src={listing.image} className="w-full h-full object-cover" alt={listing.title} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{listing.locationLabel}</p>
                    <p className="font-bold text-foreground truncate">{listing.title}</p>
                  </div>
                </div>
                <div className="border-t pt-6 space-y-4 text-sm font-medium">
                  <div className="flex justify-between text-stone-600">
                    <span>{t("price.perNight", { price: `₩${listing.pricePerNight.toLocaleString()}`, nights: nights > 0 ? nights : "—" })}</span>
                    <span className="font-bold">{nights > 0 ? `₩${subtotal.toLocaleString()}` : "—"}</span>
                  </div>
                  <div className="flex justify-between border-t border-stone-200 pt-5 text-xl font-bold text-stone-900">
                    <span>{t("price.total")}</span>
                    <div className="text-right">
                      <p>{nights > 0 ? `₩${subtotal.toLocaleString()}` : "—"}</p>
                      {nights > 0 && (
                        <p className="text-sm font-medium text-primary">
                          ≈ {rateLoading ? "..." : (subtotal / pythRate).toFixed(2)} USDC
                        </p>
                      )}
                    </div>
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
