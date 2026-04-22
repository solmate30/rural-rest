/**
 * admin.listing.new.tsx
 * 어드민 전용 숙소 등록 — 6단계 멀티스텝 폼.
 *
 * 단계: 위치 → 기본정보 → 편의시설 → 사진 → 가격/옵션 → 검토/제출
 * 단계 이동은 클라이언트 상태(step)로 관리, 서버 요청 없음.
 * 최종 제출(6단계)에서만 action 호출 → DB INSERT → /host/edit/:id redirect.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Form, useActionData, useNavigation, redirect, useLoaderData } from "react-router";
import { RichTextEditor } from "~/components/ui/rich-text-editor";
import type { Route } from "./+types/admin.listing.new";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { listings, user as userTable } from "~/db/schema";
import { translateText } from "~/lib/translation.server";
import { sql, eq } from "drizzle-orm";
import { Button } from "~/components/ui/button";
import { REGION_OPTIONS, AMENITY_OPTIONS, deriveRegion } from "~/lib/listing-constants";
import { useCloudinaryUpload } from "~/hooks/use-cloudinary-upload";
import type { RegionValue } from "~/lib/listing-constants";

// ────────────────────────────────────────────────────────────
// Daum 우편번호 SDK 타입
// ────────────────────────────────────────────────────────────

declare global {
    interface Window {
        daum: {
            Postcode: new (options: {
                oncomplete: (data: DaumPostcodeResult) => void;
            }) => { open: () => void };
        };
    }
}

interface DaumPostcodeResult {
    roadAddress: string;
    jibunAddress: string;
    sigunguCode: string;
    bcode: string;
}

// ────────────────────────────────────────────────────────────
// 폼 상태 타입
// ────────────────────────────────────────────────────────────

interface ListingDraft {
    location: string;
    region: RegionValue | null;
    manualRegion: RegionValue | null;
    valuationKrw: number | null;
    title: string;
    description: string;
    maxGuests: number | null;
    amenities: string[];
    images: string[];
    pricePerNight: number | null;
    transportSupport: boolean;
    smartLockEnabled: boolean;
    operatorId: string;
}

const INITIAL_DRAFT: ListingDraft = {
    location: "",
    region: null,
    manualRegion: null,
    valuationKrw: null,
    title: "",
    description: "",
    maxGuests: null,
    amenities: [],
    images: [],
    pricePerNight: null,
    transportSupport: false,
    smartLockEnabled: false,
    operatorId: "",
};

// ────────────────────────────────────────────────────────────
// loader
// ────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);
    const operators = await db
        .select({ id: userTable.id, name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.role, "operator"))
        .orderBy(userTable.name);
    return { operators };
}

// ────────────────────────────────────────────────────────────
// action
// ────────────────────────────────────────────────────────────

interface ActionErrors {
    title?: string;
    description?: string;
    pricePerNight?: string;
    maxGuests?: string;
    location?: string;
    region?: string;
    operatorId?: string;
}

export async function action({ request }: Route.ActionArgs) {
    const admin = await requireUser(request, ["admin"]);
    const fd = await request.formData();

    const title = fd.get("title")?.toString().trim() ?? "";
    const description = fd.get("description")?.toString().trim() ?? "";
    const location = fd.get("location")?.toString().trim() ?? "";
    const region = fd.get("region")?.toString().trim() ?? "";
    const pricePerNight = Number(fd.get("pricePerNight"));
    const maxGuests = Number(fd.get("maxGuests"));
    const valuationKrw = fd.get("valuationKrw") ? Number(fd.get("valuationKrw")) : null;
    const transportSupport = fd.get("transportSupport") === "true";
    const smartLockEnabled = fd.get("smartLockEnabled") === "true";
    const amenities = fd.getAll("amenities").map(String);
    const images = fd.getAll("images").map(String).filter(Boolean);
    const operatorId = fd.get("operatorId")?.toString().trim() ?? "";

    const errors: ActionErrors = {};

    if (!operatorId) errors.operatorId = "운영자를 선택해 주세요.";
    if (!title) errors.title = "validation.requiredTitle";
    else if (title.length > 100) errors.title = "validation.titleTooLong";
    if (!description) errors.description = "validation.requiredDescription";
    if (!location) errors.location = "validation.requiredLocation";
    if (!region || !REGION_OPTIONS.some((r) => r.value === region))
        errors.region = "validation.invalidRegion";
    if (!Number.isFinite(pricePerNight) || pricePerNight <= 0)
        errors.pricePerNight = "validation.requiredPrice";
    if (!Number.isFinite(maxGuests) || maxGuests <= 0 || !Number.isInteger(maxGuests))
        errors.maxGuests = "validation.requiredMaxGuests";

    if (Object.keys(errors).length > 0)
        return Response.json({ errors }, { status: 422 });

    const id = crypto.randomUUID();

    // DeepL 자동 번역 (실패 시 원문 저장)
    const [titleEnResult, descriptionEnResult] = await Promise.all([
        translateText(title, "en"),
        translateText(description, "en"),
    ]);

    // 다음 nodeNumber 채번: 기존 최대값 + 1, 빈 DB면 3001부터 시작
    const maxNodeResult = await db
        .select({ max: sql<number>`coalesce(max(${listings.nodeNumber}), 3000)` })
        .from(listings)
        .get();
    const nodeNumber = (maxNodeResult?.max ?? 3004) + 1;

    await db.insert(listings).values({
        id,
        nodeNumber,
        hostId: operatorId,
        title,
        description,
        titleEn: titleEnResult.translated,
        descriptionEn: descriptionEnResult.translated,
        pricePerNight,
        maxGuests,
        location,
        region,
        amenities,
        images,
        lat: null,
        lng: null,
        valuationKrw: valuationKrw && Number.isFinite(valuationKrw) && valuationKrw > 0
            ? valuationKrw : null,
        transportSupport,
        smartLockEnabled,
        renovationHistory: [],
        createdAt: new Date(),
    });

    return redirect("/admin");
}

// ────────────────────────────────────────────────────────────
// 주소 검색 훅
// ────────────────────────────────────────────────────────────

function useAddressSearch(
    onResult: (location: string, region: RegionValue | null, valuationKrw: number | null) => void
) {
    const [isScriptReady, setIsScriptReady] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);

    useEffect(() => {
        if (window.daum?.Postcode) { setIsScriptReady(true); return; }
        const script = document.createElement("script");
        script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
        script.onload = () => setIsScriptReady(true);
        document.head.appendChild(script);
    }, []);

    async function lookupBuilding(sigunguCd: string, bjdongCd: string, bcode: string, jibunAddress: string) {
        setIsLookingUp(true);
        setLookupError(null);
        try {
            const res = await fetch("/api/building/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sigunguCd, bjdongCd, bcode, jibunAddress }),
            });
            const data = await res.json();
            if (!res.ok) { setLookupError(data.error ?? "건축물 정보 조회 실패"); return null; }
            return data.valuationKrw ?? null;
        } catch {
            setLookupError("건축물 정보 조회 중 오류가 발생했습니다");
            return null;
        } finally {
            setIsLookingUp(false);
        }
    }

    function openPostcode() {
        if (!isScriptReady) return;
        new window.daum.Postcode({
            oncomplete: async (data: DaumPostcodeResult) => {
                const selected = data.roadAddress || data.jibunAddress;
                const region = deriveRegion(selected);
                const valuationKrw = await lookupBuilding(
                    data.sigunguCode, data.bcode.slice(5), data.bcode, data.jibunAddress
                );
                onResult(selected, region, valuationKrw);
            },
        }).open();
    }

    return { openPostcode, isScriptReady, isLookingUp, lookupError };
}

// ────────────────────────────────────────────────────────────
// UI 헬퍼
// ────────────────────────────────────────────────────────────

function Field({
    label, error, required, hint, children,
}: {
    label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
                {hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>}
            </label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}

const INPUT_CLS = "w-full h-10 rounded-xl border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

// ────────────────────────────────────────────────────────────
// 진행 표시기
// ────────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
    return (
        <div className="flex items-center justify-between mb-8">
            {steps.map((label, i) => {
                const num = i + 1;
                const done = num < current;
                const active = num === current;
                return (
                    <div key={num} className={`flex items-center gap-1 ${i < steps.length - 1 ? "flex-1" : ""}`}>
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors shrink-0 ${
                            done ? "bg-primary text-white" :
                            active ? "bg-primary/20 text-primary border border-primary" :
                            "bg-muted text-muted-foreground"
                        }`}>
                            {done ? "✓" : num}
                        </div>
                        <span className={`text-xs whitespace-nowrap hidden sm:block ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {label}
                        </span>
                        {i < steps.length - 1 && (
                            <div className={`flex-1 h-px mx-1 min-w-4 ${done ? "bg-primary" : "bg-border"}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// 각 스텝 컴포넌트
// ────────────────────────────────────────────────────────────

type OperatorOption = { id: string; name: string | null; email: string };

function Step1Location({
    draft, setDraft, errors, operators,
}: {
    draft: ListingDraft;
    setDraft: React.Dispatch<React.SetStateAction<ListingDraft>>;
    errors?: ActionErrors;
    operators: OperatorOption[];
}) {
    const { t } = useTranslation("admin");
    const addr = useAddressSearch((location, region, valuationKrw) => {
        setDraft((d) => ({ ...d, location, region, manualRegion: null, valuationKrw }));
    });

    const resolvedRegion = draft.region ?? draft.manualRegion;

    return (
        <div className="space-y-4">
            <Field label="담당 운영자" error={errors?.operatorId} required>
                <select
                    value={draft.operatorId}
                    onChange={(e) => setDraft((d) => ({ ...d, operatorId: e.target.value }))}
                    className={INPUT_CLS}
                >
                    <option value="">운영자를 선택하세요</option>
                    {operators.map((op) => (
                        <option key={op.id} value={op.id}>
                            {op.name ?? op.email} ({op.email})
                        </option>
                    ))}
                </select>
                {operators.length === 0 && (
                    <p className="text-xs text-amber-600">
                        등록된 운영자가 없습니다. 먼저 <a href="/admin/operators" className="underline">운영자 관리</a>에서 계정을 생성하세요.
                    </p>
                )}
            </Field>
            <Field label={t("new.reviewAddr")} error={errors?.location ? t(errors.location as any) : undefined} required>
                <div className="flex gap-2">
                    <div className="flex-1 h-10 rounded-xl border border-input bg-muted/30 px-4 flex items-center text-sm">
                        {draft.location
                            ? <span className="text-foreground">{draft.location}</span>
                            : <span className="text-muted-foreground">{t("new.addrPlaceholder")}</span>
                        }
                    </div>
                    <Button type="button" variant="outline" onClick={addr.openPostcode} disabled={!addr.isScriptReady} className="shrink-0">
                        {addr.isScriptReady ? t("new.addrSearch") : t("new.addrLoading")}
                    </Button>
                </div>
            </Field>

            {draft.location && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 space-y-1.5 text-sm">
                    {resolvedRegion && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("new.regionInfo")}</span>
                            <span className="font-medium">
                                {REGION_OPTIONS.find((r) => r.value === resolvedRegion)?.label}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("new.valuationInfo")}</span>
                        {addr.isLookingUp
                            ? <span className="text-xs text-muted-foreground">{t("new.valuationLooking")}</span>
                            : addr.lookupError
                                ? <span className="text-xs text-red-400">{addr.lookupError}</span>
                                : draft.valuationKrw
                                    ? <span className="font-medium">{t("new.krw", { amount: draft.valuationKrw.toLocaleString() })}</span>
                                    : <span className="text-xs text-muted-foreground">{t("new.valuationNone")}</span>
                        }
                    </div>
                </div>
            )}

            {draft.location && !draft.region && (
                <Field label={t("new.manualRegion")} error={errors?.region ? t(errors.region as any) : undefined} required>
                    <select
                        defaultValue=""
                        onChange={(e) => setDraft((d) => ({ ...d, manualRegion: e.target.value as RegionValue }))}
                        className={INPUT_CLS}
                    >
                        <option value="" disabled>{t("new.regionSelect")}</option>
                        {REGION_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </Field>
            )}

            <Field label={t("new.valuationField")} hint={t("new.valuationHint")}>
                <input
                    type="number"
                    min="0"
                    placeholder={t("new.valuationPlaceholder")}
                    value={draft.valuationKrw ?? ""}
                    onChange={(e) => setDraft((d) => ({
                        ...d, valuationKrw: e.target.value ? Number(e.target.value) : null,
                    }))}
                    className={INPUT_CLS}
                />
            </Field>
        </div>
    );
}

function Step2BasicInfo({
    draft, setDraft, errors,
}: {
    draft: ListingDraft;
    setDraft: React.Dispatch<React.SetStateAction<ListingDraft>>;
    errors?: ActionErrors;
}) {
    const { t } = useTranslation("admin");
    return (
        <div className="space-y-4">
            <Field label={t("new.titleField")} error={errors?.title ? t(errors.title as any) : undefined} required>
                <input
                    type="text"
                    placeholder={t("new.titlePlaceholder")}
                    maxLength={100}
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    className={INPUT_CLS}
                />
            </Field>
            <Field label={t("new.descField")} error={errors?.description ? t(errors.description as any) : undefined} required>
                <RichTextEditor
                    value={draft.description}
                    onChange={(html) => setDraft((d) => ({ ...d, description: html }))}
                    placeholder={t("new.descPlaceholder")}
                    className="w-full"
                />
            </Field>
            <Field label={t("new.maxGuestsField")} error={errors?.maxGuests ? t(errors.maxGuests as any) : undefined} required>
                <input
                    type="number"
                    min="1"
                    max="20"
                    placeholder="4"
                    value={draft.maxGuests ?? ""}
                    onChange={(e) => setDraft((d) => ({
                        ...d, maxGuests: e.target.value ? Number(e.target.value) : null,
                    }))}
                    className={INPUT_CLS}
                />
            </Field>
        </div>
    );
}

function Step3Amenities({
    draft, setDraft,
}: {
    draft: ListingDraft;
    setDraft: React.Dispatch<React.SetStateAction<ListingDraft>>;
}) {
    function toggle(amenity: string) {
        setDraft((d) => ({
            ...d,
            amenities: d.amenities.includes(amenity)
                ? d.amenities.filter((a) => a !== amenity)
                : [...d.amenities, amenity],
        }));
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AMENITY_OPTIONS.map((amenity) => {
                const checked = draft.amenities.includes(amenity);
                return (
                    <label
                        key={amenity}
                        onClick={() => toggle(amenity)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                            checked
                                ? "bg-primary/5 border-primary/40"
                                : "border-border hover:bg-muted/50"
                        }`}
                    >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            checked ? "bg-primary border-primary" : "border-input"
                        }`}>
                            {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                        </div>
                        <span className="text-sm font-medium text-foreground">{amenity}</span>
                    </label>
                );
            })}
        </div>
    );
}

function Step4Photos({
    draft, setDraft, onUploadingChange,
}: {
    draft: ListingDraft;
    setDraft: React.Dispatch<React.SetStateAction<ListingDraft>>;
    onUploadingChange?: (uploading: boolean) => void;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    // 임시 listing ID — Cloudinary 폴더 구분용 (DB INSERT 전)
    const tempId = useRef(crypto.randomUUID());

    const { upload, isUploading, progress } = useCloudinaryUpload({
        type: "listing",
        listingId: tempId.current,
        onSuccess: (result) => {
            setDraft((d) => ({ ...d, images: [...d.images, result.secureUrl] }));
        },
        onError: (err) => alert(err),
    });

    useEffect(() => {
        onUploadingChange?.(isUploading);
    }, [isUploading, onUploadingChange]);

    async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files) return;
        for (let i = 0; i < files.length; i++) {
            await upload(files[i]);
        }
        e.target.value = "";
    }

    function removeImage(url: string) {
        setDraft((d) => ({ ...d, images: d.images.filter((u) => u !== url) }));
    }

    const { t } = useTranslation("admin");

    return (
        <div className="space-y-4">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFiles}
            />

            {draft.images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {draft.images.map((url, idx) => (
                        <div key={url} className="relative aspect-video rounded-xl overflow-hidden border group">
                            <img src={url} alt={`photo ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => removeImage(url)}
                                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove photo"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/30 transition-colors"
                    >
                        <span className="text-xl">+</span>
                        <span className="text-xs mt-1">{t("new.addMore")}</span>
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full rounded-xl border-2 border-dashed border-border p-10 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    <p className="text-sm font-medium">{t("new.uploadClick")}</p>
                    <p className="text-xs">{t("new.uploadFileHint")}</p>
                </button>
            )}

            {isUploading && (
                <div className="space-y-1.5">
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">{t("new.uploading", { pct: progress })}</p>
                </div>
            )}
        </div>
    );
}

function Step5Pricing({
    draft, setDraft, errors,
}: {
    draft: ListingDraft;
    setDraft: React.Dispatch<React.SetStateAction<ListingDraft>>;
    errors?: ActionErrors;
}) {
    const { t } = useTranslation("admin");
    return (
        <div className="space-y-4">
            <Field label={t("new.priceField")} error={errors?.pricePerNight ? t(errors.pricePerNight as any) : undefined} required>
                <input
                    type="number"
                    min="1"
                    placeholder="120000"
                    value={draft.pricePerNight ?? ""}
                    onChange={(e) => setDraft((d) => ({
                        ...d, pricePerNight: e.target.value ? Number(e.target.value) : null,
                    }))}
                    className={INPUT_CLS}
                />
            </Field>
            <div className="space-y-3">
                {([
                    { key: "transportSupport", label: t("new.transportLabel"), desc: t("new.transportDesc") },
                    { key: "smartLockEnabled", label: t("new.smartLockLabel"), desc: t("new.smartLockDesc") },
                ] as const).map(({ key, label, desc }) => (
                    <label
                        key={key}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                            draft[key] ? "bg-primary/5 border-primary/40" : "border-border hover:bg-muted/50"
                        }`}
                    >
                        <div>
                            <p className="text-sm font-medium text-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={draft[key]}
                            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                            className="accent-primary h-4 w-4"
                        />
                    </label>
                ))}
            </div>
        </div>
    );
}

function Step6Review({
    draft, errors, isSubmitting, operators,
}: {
    draft: ListingDraft;
    errors?: ActionErrors;
    isSubmitting: boolean;
    operators: OperatorOption[];
}) {
    const { t } = useTranslation("admin");
    const resolvedRegion = draft.region ?? draft.manualRegion;
    const selectedOperator = operators.find((op) => op.id === draft.operatorId);

    const rows: [string, string][] = [
        ["담당 운영자", selectedOperator ? `${selectedOperator.name ?? selectedOperator.email} (${selectedOperator.email})` : "-"],
        [t("new.reviewAddr"), draft.location || "-"],
        [t("new.reviewRegion"), REGION_OPTIONS.find((r) => r.value === resolvedRegion)?.label ?? "-"],
        [t("new.reviewValuation"), draft.valuationKrw ? t("new.krw", { amount: draft.valuationKrw.toLocaleString() }) : "-"],
        [t("new.reviewTitle"), draft.title || "-"],
        [t("new.reviewDesc"), draft.description ? (() => { const text = draft.description.replace(/<[^>]*>/g, "").trim(); return text.length > 50 ? `${text.slice(0, 50)}...` : text || "-"; })() : "-"],
        [t("new.reviewMaxGuests"), draft.maxGuests ? t("new.guests", { count: draft.maxGuests }) : "-"],
        [t("new.reviewAmenities"), draft.amenities.length > 0 ? draft.amenities.join(", ") : t("new.noAmenities")],
        [t("new.reviewPrice"), draft.pricePerNight ? t("new.krw", { amount: draft.pricePerNight.toLocaleString() }) : "-"],
        [t("new.reviewTransport"), draft.transportSupport ? t("new.yes") : t("new.no")],
        [t("new.reviewSmartLock"), draft.smartLockEnabled ? t("new.yes") : t("new.no")],
    ];

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-border divide-y divide-border">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground text-right max-w-[60%]">{value}</span>
                    </div>
                ))}
            </div>

            {/* 서버 검증 에러 표시 */}
            {errors && Object.keys(errors).length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 space-y-1">
                    {Object.values(errors).map((e, i) => <p key={i}>{e}</p>)}
                </div>
            )}

            {/* action으로 전송할 hidden fields */}
            <input type="hidden" name="operatorId" value={draft.operatorId} />
            <input type="hidden" name="location" value={draft.location} />
            <input type="hidden" name="region" value={resolvedRegion ?? ""} />
            <input type="hidden" name="valuationKrw" value={draft.valuationKrw ?? ""} />
            <input type="hidden" name="title" value={draft.title} />
            <input type="hidden" name="description" value={draft.description} />
            <input type="hidden" name="maxGuests" value={draft.maxGuests ?? ""} />
            <input type="hidden" name="pricePerNight" value={draft.pricePerNight ?? ""} />
            <input type="hidden" name="transportSupport" value={String(draft.transportSupport)} />
            <input type="hidden" name="smartLockEnabled" value={String(draft.smartLockEnabled)} />
            {draft.amenities.map((a) => (
                <input key={a} type="hidden" name="amenities" value={a} />
            ))}
            {draft.images.map((url) => (
                <input key={url} type="hidden" name="images" value={url} />
            ))}

            <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-base">
                {isSubmitting ? t("new.submitting") : t("new.submit")}
            </Button>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// 페이지 컴포넌트
// ────────────────────────────────────────────────────────────

export default function AdminListingNew() {
    const { operators } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const { t } = useTranslation("admin");
    const isSubmitting = navigation.state === "submitting";
    const errors = (actionData as { errors?: ActionErrors } | undefined)?.errors;

    const [step, setStep] = useState(1);
    const [draft, setDraft] = useState<ListingDraft>(INITIAL_DRAFT);
    const [isPhotoUploading, setIsPhotoUploading] = useState(false);

    const resolvedRegion = draft.region ?? draft.manualRegion;

    function canAdvance(): boolean {
        if (step === 1) return !!draft.operatorId && !!draft.location && !!resolvedRegion;
        if (step === 2) return !!draft.title && !!draft.description && !!draft.maxGuests;
        if (step === 4) return !isPhotoUploading;
        if (step === 5) return !!draft.pricePerNight;
        return true;
    }

    const STEPS = [
        t("new.step1"), t("new.step2"), t("new.step3"),
        t("new.step4"), t("new.step5"), t("new.step6"),
    ];

    const STEP_TITLES = [
        t("new.title1"), t("new.title2"), t("new.title3"),
        t("new.title4"), t("new.title5"), t("new.title6"),
    ];

    return (
        <div>
            <main className="pb-12">
                <div className="mb-8 space-y-1">
                    <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">{t("new.breadcrumb")}</p>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{STEP_TITLES[step - 1]}</h1>
                </div>

                <StepIndicator current={step} steps={STEPS} />

                <Form method="post" className="space-y-6">
                    <div className="p-6 rounded-2xl border border-border bg-card min-h-[300px]">
                        {step === 1 && <Step1Location draft={draft} setDraft={setDraft} errors={errors} operators={operators} />}
                        {step === 2 && <Step2BasicInfo draft={draft} setDraft={setDraft} errors={errors} />}
                        {step === 3 && <Step3Amenities draft={draft} setDraft={setDraft} />}
                        {step === 4 && <Step4Photos draft={draft} setDraft={setDraft} onUploadingChange={setIsPhotoUploading} />}
                        {step === 5 && <Step5Pricing draft={draft} setDraft={setDraft} errors={errors} />}
                        {step === 6 && <Step6Review draft={draft} errors={errors} isSubmitting={isSubmitting} operators={operators} />}
                    </div>

                    <div className="flex justify-between gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => step === 1 ? history.back() : setStep((s) => s - 1)}
                        >
                            {step === 1 ? t("new.cancel") : t("new.prev")}
                        </Button>
                        {step < 6 && (
                            <Button
                                type="button"
                                onClick={() => setStep((s) => s + 1)}
                                disabled={!canAdvance()}
                                className="px-8"
                            >
                                {t("new.next")}
                            </Button>
                        )}
                    </div>
                </Form>
            </main>
        </div>
    );
}
