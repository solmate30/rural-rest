/**
 * admin.edit.tsx
 * 숙소 수정 페이지 — /host/edit/:id
 *
 * loader: DB에서 listing 조회
 * action: title, description, pricePerNight, maxGuests, images, amenities,
 *         transportSupport, smartLockEnabled 업데이트
 * Availability 캘린더: 정적 목업 유지
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RichTextEditor } from "~/components/ui/rich-text-editor";
import { Form, useLoaderData, useActionData, useNavigation, useBlocker } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin.edit";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { listings } from "~/db/schema";
import { translateText } from "~/lib/translation.server";
import { eq } from "drizzle-orm";
import { Header, Button, Card } from "../components/ui-mockup";
import { useCloudinaryUpload } from "~/hooks/use-cloudinary-upload";
import { AMENITY_OPTIONS } from "~/lib/listing-constants";

const listingSchema = z.object({
    title:        z.string().min(2, "validation.titleMin").max(100, "validation.titleMax"),
    description:  z.string().min(10, "validation.descMin"),
    pricePerNight: z.number({ error: "validation.requiredPrice" }).min(1, "validation.requiredPrice"),
    maxGuests:    z.number({ error: "validation.requiredMaxGuests" }).min(1, "validation.requiredMaxGuests").max(20, "validation.maxGuestsMax"),
});

// ────────────────────────────────────────────────────────────
// loader
// ────────────────────────────────────────────────────────────

export async function loader({ request, params }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);
    const [listing] = await db
        .select()
        .from(listings)
        .where(eq(listings.id, params.id));
    if (!listing) throw new Response("Not Found", { status: 404 });
    return { listing };
}

// ────────────────────────────────────────────────────────────
// action
// ────────────────────────────────────────────────────────────

export async function action({ request, params }: Route.ActionArgs) {
    await requireUser(request, ["admin"]);
    const fd = await request.formData();

    const title = fd.get("title")?.toString().trim() ?? "";
    const description = fd.get("description")?.toString().trim() ?? "";
    const pricePerNight = Number(fd.get("pricePerNight"));
    const maxGuests = Number(fd.get("maxGuests"));
    const transportSupport = fd.get("transportSupport") === "true";
    const smartLockEnabled = fd.get("smartLockEnabled") === "true";
    const amenities = fd.getAll("amenities").map(String);
    const images = fd.getAll("images").map(String).filter(Boolean);

    const errors: Record<string, string> = {};
    if (!title) errors.title = "validation.requiredTitle";
    if (!description) errors.description = "validation.requiredDescription";
    if (!Number.isFinite(pricePerNight) || pricePerNight <= 0) errors.pricePerNight = "validation.requiredPrice";
    if (!Number.isFinite(maxGuests) || maxGuests <= 0) errors.maxGuests = "validation.requiredMaxGuests";

    if (Object.keys(errors).length > 0)
        return Response.json({ errors }, { status: 422 });

    // DeepL 자동 번역 (실패 시 원문 저장)
    const [titleEnResult, descriptionEnResult] = await Promise.all([
        translateText(title, "en"),
        translateText(description, "en"),
    ]);

    await db
        .update(listings)
        .set({
            title,
            description,
            titleEn: titleEnResult.translated,
            descriptionEn: descriptionEnResult.translated,
            pricePerNight,
            maxGuests,
            amenities,
            images,
            transportSupport,
            smartLockEnabled,
        })
        .where(eq(listings.id, params.id));

    return Response.json({ ok: true });
}

// ────────────────────────────────────────────────────────────
// 컴포넌트
// ────────────────────────────────────────────────────────────

const INPUT_CLS = "w-full h-10 rounded-xl border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function AdminEdit() {
    const { listing } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const { t } = useTranslation("admin");
    const isSaving = navigation.state === "submitting";
    const serverErrors = (actionData as { errors?: Record<string, string> } | undefined)?.errors;
    const saved = (actionData as { ok?: boolean } | undefined)?.ok;

    const initialImages = (() => {
        const raw = listing.images;
        if (!raw) return [] as string[];
        if (typeof raw === "string") { try { return JSON.parse(raw) as string[]; } catch { return [] as string[]; } }
        return raw as unknown as string[];
    })();

    const [title, setTitle] = useState(listing.title);
    const [description, setDescription] = useState(listing.description);
    const [pricePerNight, setPricePerNight] = useState(listing.pricePerNight);
    const [maxGuests, setMaxGuests] = useState(listing.maxGuests);
    const [amenities, setAmenities] = useState<string[]>((listing.amenities as unknown as string[]) ?? []);
    const [images, setImages] = useState<string[]>(initialImages);
    const [transportSupport, setTransportSupport] = useState(listing.transportSupport);
    const [smartLockEnabled, setSmartLockEnabled] = useState(listing.smartLockEnabled);

    // ── 실시간 검증
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

    function validateField(name: string, value: unknown) {
        const partial = listingSchema.pick({ [name]: true } as never).safeParse({ [name]: value });
        if (!partial.success) {
            const msg = partial.error.issues[0]?.message ?? "";
            setFieldErrors((prev) => ({ ...prev, [name]: t(msg as any) }));
        } else {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
        }
    }

    // 서버 에러와 클라이언트 에러 병합 (클라이언트 우선)
    const errors = {
        ...(serverErrors ? Object.fromEntries(Object.entries(serverErrors).map(([k, v]) => [k, t(v as any)])) : {}),
        ...fieldErrors,
    };

    // ── 미저장 감지
    const isDirty =
        title !== listing.title ||
        description !== listing.description ||
        pricePerNight !== listing.pricePerNight ||
        maxGuests !== listing.maxGuests ||
        transportSupport !== listing.transportSupport ||
        smartLockEnabled !== listing.smartLockEnabled ||
        JSON.stringify([...amenities].sort()) !== JSON.stringify(((listing.amenities as unknown as string[]) ?? []).slice().sort()) ||
        JSON.stringify(images) !== JSON.stringify(initialImages);

    // 브라우저 새로고침/탭 닫기 경고
    useEffect(() => {
        function handleBeforeUnload(e: BeforeUnloadEvent) {
            if (isDirty && !saved) {
                e.preventDefault();
            }
        }
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty, saved]);

    // React Router 내비게이션 차단
    const blocker = useBlocker(isDirty && !saved && !isSaving);
    const handleBlockerProceed = useCallback(() => blocker.proceed?.(), [blocker]);
    const handleBlockerReset   = useCallback(() => blocker.reset?.(),   [blocker]);

    // ── 사진 업로드
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { upload, isUploading, progress } = useCloudinaryUpload({
        type: "listing",
        listingId: listing.id,
        onSuccess: (result) => setImages((prev) => [...prev, result.secureUrl]),
        onError: (err) => alert(`${t("edit.uploadError")}: ${err}`),
    });

    async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files) return;
        for (let i = 0; i < files.length; i++) await upload(files[i]);
        e.target.value = "";
    }

    function removeImage(url: string) {
        setImages((prev) => prev.filter((u) => u !== url));
    }

    function toggleAmenity(a: string) {
        setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
    }

    return (
        <>
        <Form method="post">
            {/* hidden fields */}
            {images.map((url) => <input key={url} type="hidden" name="images" value={url} />)}
            {amenities.map((a) => <input key={a} type="hidden" name="amenities" value={a} />)}
            <input type="hidden" name="transportSupport" value={String(transportSupport)} />
            <input type="hidden" name="smartLockEnabled" value={String(smartLockEnabled)} />

            <div className="min-h-screen bg-stone-50/50">
                <Header />
                <main className="container mx-auto py-12 px-4 max-w-4xl">
                    <div className="flex items-center justify-between mb-8">
                        <div className="space-y-1">
                            <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">{t("edit.breadcrumb")}</p>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">{listing.title}</h1>
                            <p className="text-sm text-muted-foreground">{listing.location}</p>
                        </div>
                    </div>

                    <div className="space-y-10 pb-32">
                        {/* 사진 */}
                        <section className="space-y-4">
                            <SectionTitle>{t("edit.photoManager")}</SectionTitle>
                            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} />
                            <Card className="p-6 relative overflow-hidden min-h-[200px]">
                                {isUploading && (
                                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2">
                                        <div className="w-48 h-2 bg-stone-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                                        </div>
                                        <p className="text-xs text-primary font-medium">{t("edit.uploading", { pct: progress })}</p>
                                    </div>
                                )}
                                {images.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-4">
                                        {images.map((url, idx) => (
                                            <div key={url} className="relative aspect-video rounded-xl overflow-hidden border group">
                                                <img src={url} alt={`사진 ${idx + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(url)}
                                                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >×</button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-stone-100 transition-colors"
                                        >
                                            <span className="text-xl">+</span>
                                            <span className="text-xs mt-1">{t("edit.addMore")}</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                        </div>
                                        <p className="font-medium text-sm">{t("edit.photoUploadPrompt")}</p>
                                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>{t("edit.browseFiles")}</Button>
                                    </div>
                                )}
                            </Card>
                        </section>

                        {/* 기본 정보 */}
                        <section className="space-y-4">
                            <SectionTitle>{t("edit.basicInfoSection")}</SectionTitle>
                            <Card className="p-8 space-y-6">
                                <Field label={t("edit.propertyTitle")} error={errors?.title} required>
                                    <input
                                        name="title"
                                        value={title}
                                        onChange={(e) => { setTitle(e.target.value); validateField("title", e.target.value); }}
                                        className={INPUT_CLS}
                                        maxLength={100}
                                    />
                                </Field>
                                <Field label={t("edit.description")} error={errors?.description} required>
                                    <RichTextEditor
                                        value={description}
                                        onChange={(html) => { setDescription(html); validateField("description", html); }}
                                        className="w-full"
                                    />
                                </Field>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label={t("edit.basePrice")} error={errors?.pricePerNight} required>
                                        <input
                                            name="pricePerNight"
                                            type="number"
                                            min="1"
                                            value={pricePerNight}
                                            onChange={(e) => { setPricePerNight(Number(e.target.value)); validateField("pricePerNight", Number(e.target.value)); }}
                                            className={INPUT_CLS}
                                        />
                                    </Field>
                                    <Field label={t("edit.maxGuests")} error={errors?.maxGuests} required>
                                        <input
                                            name="maxGuests"
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={maxGuests}
                                            onChange={(e) => { setMaxGuests(Number(e.target.value)); validateField("maxGuests", Number(e.target.value)); }}
                                            className={INPUT_CLS}
                                        />
                                    </Field>
                                </div>
                            </Card>
                        </section>

                        {/* 편의시설 */}
                        <section className="space-y-4">
                            <SectionTitle>{t("edit.listingDetails")}</SectionTitle>
                            <Card className="p-8">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {AMENITY_OPTIONS.map((a) => (
                                        <button
                                            key={a}
                                            type="button"
                                            onClick={() => toggleAmenity(a)}
                                            className={`px-4 py-2.5 rounded-xl text-sm border transition-colors text-left ${
                                                amenities.includes(a)
                                                    ? "bg-primary/10 border-primary text-primary font-medium"
                                                    : "border-border text-muted-foreground hover:bg-muted/40"
                                            }`}
                                        >
                                            {a}
                                        </button>
                                    ))}
                                </div>
                            </Card>
                        </section>

                        {/* 옵션 */}
                        <section className="space-y-4">
                            <SectionTitle>{t("edit.availability")}</SectionTitle>
                            <Card className="p-8 space-y-4">
                                <ToggleRow
                                    label={t("edit.transportLabel")}
                                    description={t("edit.transportDesc")}
                                    value={transportSupport}
                                    onChange={setTransportSupport}
                                />
                                <ToggleRow
                                    label={t("edit.smartLockLabel")}
                                    description={t("edit.smartLockDesc")}
                                    value={smartLockEnabled}
                                    onChange={setSmartLockEnabled}
                                />
                            </Card>
                        </section>

                        {/* Availability — 정적 목업 */}
                        <section className="space-y-4">
                            <SectionTitle>{t("edit.availabilitySection")}</SectionTitle>
                            <Card className="p-8 flex flex-col items-center">
                                <div className="w-full max-w-sm border rounded-2xl p-6 bg-white overflow-hidden shadow-inner">
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="font-bold">May 2026</span>
                                        <div className="flex gap-2">
                                            <Button type="button" variant="ghost" className="h-8 w-8 p-0 border">←</Button>
                                            <Button type="button" variant="ghost" className="h-8 w-8 p-0 border">→</Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-muted-foreground uppercase mb-2">
                                        {["일","월","화","수","목","금","토"].map((d) => <span key={d}>{d}</span>)}
                                    </div>
                                    <div className="grid grid-cols-7 gap-2">
                                        {Array.from({ length: 31 }).map((_, i) => (
                                            <div key={i} className={`h-10 rounded-lg flex flex-col items-center justify-center text-xs ${i + 1 === 15 ? "bg-primary text-white" : "hover:bg-primary/5 cursor-pointer border border-transparent hover:border-primary/20"}`}>
                                                <span>{i + 1}</span>
                                                <span className="text-[8px] opacity-70">120k</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <p className="mt-4 text-xs text-muted-foreground">{t("edit.availabilityPhase")}</p>
                            </Card>
                        </section>
                    </div>
                </main>

                {/* Sticky Save Bar */}
                <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/80 backdrop-blur-xl border-t z-50 shadow-2xl">
                    <div className="container mx-auto flex justify-between items-center max-w-4xl">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            {saved ? t("edit.savedState") : t("edit.editingState")}
                        </div>
                        <Button type="submit" disabled={isSaving} className="px-8">
                            {isSaving ? t("edit.saving") : t("edit.save")}
                        </Button>
                    </div>
                </div>
            </div>
        </Form>

        {/* 미저장 변경사항 내비게이션 차단 모달 */}
        {blocker.state === "blocked" && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 space-y-4">
                    <h2 className="text-lg font-bold text-foreground">{t("edit.blockerTitle")}</h2>
                    <p className="text-sm text-muted-foreground">{t("edit.blockerMessage")}</p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleBlockerReset}
                            className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted/40 transition-colors"
                        >
                            {t("edit.blockerStay")}
                        </button>
                        <button
                            type="button"
                            onClick={handleBlockerProceed}
                            className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                            {t("edit.blockerLeave")}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

// ────────────────────────────────────────────────────────────
// 내부 컴포넌트
// ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="h-6 w-1 bg-primary rounded-full" />
            {children}
        </h2>
    );
}

function Field({ label, required, error, children }: {
    label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}

function ToggleRow({ label, description, value, onChange }: {
    label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <button
                type="button"
                onClick={() => onChange(!value)}
                className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}
            >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
        </div>
    );
}
