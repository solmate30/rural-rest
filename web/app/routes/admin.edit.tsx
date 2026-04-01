import { Header, Button, Input, Card } from "../components/ui-mockup";
import { useTranslation } from "react-i18next";
import { useCloudinaryUpload } from "~/hooks/use-cloudinary-upload";
import { useState, useRef } from "react";

export default function AdminEdit() {
    const { t } = useTranslation("admin");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [images, setImages] = useState<string[]>([]);

    // Cloudinary Upload Hook
    const { upload, isUploading, progress } = useCloudinaryUpload({
        type: "listing",
        listingId: "listing_1", // Placeholder for testing
        onSuccess: (result) => {
            setImages((prev) => [...prev, result.secureUrl]);
            console.log("Upload Success:", result);
        },
        onError: (error) => {
            alert("Upload failed: " + error);
        }
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
            await upload(files[i]);
        }
    };

    return (
        <div className="min-h-screen bg-stone-50/50">
            <Header />
            <main className="container mx-auto py-12 px-4 max-w-4xl">
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("edit.title")}</h1>
                        <p className="text-muted-foreground">{t("edit.desc")}</p>
                    </div>
                    <div className="flex gap-4">
                        <Button variant="outline">{t("edit.previewGuest")}</Button>
                        <Button>{t("edit.saveChanges")}</Button>
                    </div>
                </div>

                <div className="space-y-10 pb-32">
                    {/* Section 1: Photos */}
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="h-6 w-1 bg-primary rounded-full" />
                            {t("edit.photoManager")}
                        </h2>
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                        />
                        <Card className="p-10 border-dashed border-2 bg-stone-50 flex flex-col items-center justify-center space-y-4 min-h-[300px] relative overflow-hidden">
                            {isUploading && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center space-y-2">
                                    <div className="w-48 h-2 bg-stone-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs font-medium text-primary uppercase tracking-widest">{t("edit.uploading", { pct: progress })}</p>
                                </div>
                            )}

                            {images.length > 0 ? (
                                <div className="grid grid-cols-3 gap-4 w-full">
                                    {images.map((url, idx) => (
                                        <div key={idx} className="aspect-video rounded-xl overflow-hidden border shadow-sm group relative">
                                            <img src={url} alt={`Listing ${idx}`} className="w-full h-full object-cover" />
                                            <button className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-stone-100 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                                        <span className="text-xs mt-1 font-medium">{t("edit.addMore")}</span>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold">{t("edit.uploadHint")}</p>
                                        <p className="text-sm text-muted-foreground">{t("edit.uploadHint2")}</p>
                                    </div>
                                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>{t("edit.browseFiles")}</Button>
                                </>
                            )}
                        </Card>
                    </section>

                    {/* Section 2: Listing Details */}
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="h-6 w-1 bg-primary rounded-full" />
                            {t("edit.listingDetails")}
                        </h2>
                        <Card className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("edit.propertyTitle")}</label>
                                <Input defaultValue={t("edit.propertyTitleEx")} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("edit.description")}</label>
                                <div className="border rounded-xl bg-background overflow-hidden">
                                    <div className="border-b bg-stone-50 p-2 flex gap-4">
                                        <button className="p-1 hover:bg-white rounded font-bold">B</button>
                                        <button className="p-1 hover:bg-white rounded italic">I</button>
                                        <button className="p-1 hover:bg-white rounded underline">U</button>
                                    </div>
                                    <textarea className="w-full min-h-[200px] p-4 text-sm focus:outline-none bg-transparent" defaultValue={t("edit.descriptionEx")}></textarea>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t("edit.basePrice")}</label>
                                    <Input type="number" defaultValue={t("edit.basePriceEx")} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t("edit.maxGuests")}</label>
                                    <Input type="number" defaultValue={t("edit.maxGuestsEx")} />
                                </div>
                            </div>
                        </Card>
                    </section>

                    {/* Section 3: Availability (Static Mock) */}
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="h-6 w-1 bg-primary rounded-full" />
                            {t("edit.availability")}
                        </h2>
                        <Card className="p-8 flex flex-col items-center">
                            <div className="w-full max-w-sm border rounded-2xl p-6 bg-white overflow-hidden shadow-inner">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="font-bold">May 2026</span>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" className="h-8 w-8 p-0 border">←</Button>
                                        <Button variant="ghost" className="h-8 w-8 p-0 border">→</Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-muted-foreground uppercase mb-2">
                                    <span>{t("edit.days.sun")}</span>
                                    <span>{t("edit.days.mon")}</span>
                                    <span>{t("edit.days.tue")}</span>
                                    <span>{t("edit.days.wed")}</span>
                                    <span>{t("edit.days.thu")}</span>
                                    <span>{t("edit.days.fri")}</span>
                                    <span>{t("edit.days.sat")}</span>
                                </div>
                                <div className="grid grid-cols-7 gap-2">
                                    {Array.from({ length: 31 }).map((_, i) => (
                                        <div key={i} className={`h-10 rounded-lg flex flex-col items-center justify-center text-xs relative ${i + 1 === 15 ? 'bg-primary text-white shadow-md' : 'hover:bg-primary/5 cursor-pointer border border-transparent hover:border-primary/20'}`}>
                                            <span>{i + 1}</span>
                                            <span className="text-[8px] opacity-70">120k</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-8 flex gap-6 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded bg-primary" /> {t("edit.legend.available")}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded bg-stone-200" /> {t("edit.legend.blocked")}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded border border-primary/40 bg-primary/5" /> {t("edit.legend.selected")}
                                </div>
                            </div>
                        </Card>
                    </section>
                </div>
            </main>

            {/* Sticky Save Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t z-50 shadow-2xl">
                <div className="container mx-auto flex justify-between items-center max-w-4xl">
                    <div className="flex items-center gap-2 text-primary font-medium">
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        {t("edit.editingActive")}
                    </div>
                    <div className="flex gap-4">
                        <Button variant="outline" className="px-8 shadow-sm">{t("edit.discard")}</Button>
                        <Button className="px-8 shadow-md">{t("edit.publish")}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
