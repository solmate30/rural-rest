import { useState } from "react";
import { Button } from "~/components/ui-mockup";

interface Props {
    images: string[];
    title: string;
}

export function PropertyGallery({ images, title }: Props) {
    const [showGallery, setShowGallery] = useState(false);

    return (
        <>
            <section className="mb-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[450px]">
                    {/* Main Image */}
                    <div className="md:col-span-3 rounded-2xl overflow-hidden shadow-lg relative group h-[280px] md:h-full">
                        <img
                            src={images[0]}
                            className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                            alt={title}
                            onClick={() => setShowGallery(true)}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                    </div>

                    {/* Side column */}
                    <div className="hidden md:grid grid-rows-2 gap-4">
                        <div className="rounded-2xl overflow-hidden shadow-md relative group">
                            <img
                                src={images[1] || images[0]}
                                className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                                alt={`${title} 2`}
                                onClick={() => setShowGallery(true)}
                            />
                        </div>
                        <button
                            className="rounded-2xl overflow-hidden shadow-md bg-stone-100 flex flex-col items-center justify-center gap-2 font-bold text-stone-600 hover:bg-stone-200 transition-colors group"
                            onClick={() => setShowGallery(true)}
                        >
                            <svg className="w-6 h-6 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                            </svg>
                            {images.length > 2
                                ? <span>+{images.length - 2} Photos</span>
                                : <span>All Photos</span>
                            }
                        </button>
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden">
                        <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowGallery(true)}>
                            모든 사진 보기 ({images.length})
                        </Button>
                    </div>
                </div>
            </section>

            {/* Gallery Modal */}
            {showGallery && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
                    <div className="sticky top-0 z-[110] flex justify-between items-center p-6 bg-black/40 backdrop-blur-md border-b border-white/10">
                        <div className="flex flex-col">
                            <h2 className="text-white text-xl font-bold">{title}</h2>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest">
                                Gallery — {images.length} Photos
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            className="text-white hover:bg-white/10 h-12 w-12 rounded-full p-0"
                            onClick={() => setShowGallery(false)}
                        >
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Button>
                    </div>
                    <div className="max-w-6xl mx-auto px-6 py-12 md:columns-2 lg:columns-3 gap-6 space-y-6">
                        {images.map((img, i) => (
                            <div key={i} className="group relative rounded-2xl overflow-hidden shadow-2xl break-inside-avoid animate-in zoom-in-95 duration-500">
                                <img
                                    src={img}
                                    className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
                                    alt={`${title} gallery ${i + 1}`}
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
