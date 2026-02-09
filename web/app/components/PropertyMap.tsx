import { useEffect, useRef, useState } from "react";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

declare global {
    interface Window {
        google?: {
            maps: {
                Map: new (el: HTMLElement, opts: { center: { lat: number; lng: number }; zoom: number; [k: string]: unknown }) => unknown;
                Marker: new (opts: { position: { lat: number; lng: number }; map: unknown; title?: string }) => unknown;
            };
        };
        __ruralRestMapsResolve?: () => void;
    }
}

let loadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
    if (typeof window === "undefined" || !API_KEY) return Promise.resolve();
    if (window.google?.maps?.Map) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
        const existing = document.getElementById("google-maps-script");
        if (existing) {
            if (window.google?.maps?.Map) resolve();
            else window.__ruralRestMapsResolve = resolve;
            return;
        }
        const timeout = window.setTimeout(() => {
            reject(new Error("Google Maps load timeout. Check API key and Console (Maps JavaScript API, referrer)."));
        }, 12000);
        window.__ruralRestMapsResolve = () => {
            window.clearTimeout(timeout);
            resolve();
        };
        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async&callback=__ruralRestMapsResolve`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error("Failed to load Google Maps script"));
        };
        document.head.appendChild(script);
    });
    return loadPromise;
}

export interface PropertyMapProps {
    lat: number;
    lng: number;
    locationLabel?: string;
    className?: string;
    height?: number;
}

export function PropertyMap({ lat, lng, locationLabel, className = "", height = 280 }: PropertyMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!API_KEY) {
            setError("Google Maps API key not configured");
            return;
        }
        const el = containerRef.current;
        if (!el) return;

        loadGoogleMaps()
            .then(() => {
                if (!el || !window.google?.maps?.Map) return;
                const map = new window.google.maps.Map(el, {
                    center: { lat, lng },
                    zoom: 14,
                    disableDefaultUI: false,
                    zoomControl: true,
                    mapTypeControl: true,
                    scaleControl: true,
                    fullscreenControl: true,
                    streetViewControl: true,
                });
                new window.google.maps.Marker({
                    position: { lat, lng },
                    map,
                    title: locationLabel ?? "Property location",
                });
            })
            .catch((err) => setError(err?.message ?? "Failed to load map"));

        return () => {
            window.__ruralRestMapsResolve = () => {};
        };
    }, [lat, lng, locationLabel]);

    if (!API_KEY || error) {
        return (
            <div
                className={`relative rounded-2xl overflow-hidden border border-stone-100 ${className}`}
                style={{ height }}
                aria-label="Map placeholder"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-lime-50 flex items-center justify-center">
                    <p className="text-sm text-stone-500">
                        {error ?? "Map not available"}
                    </p>
                </div>
                <p className="absolute bottom-3 left-3 text-xs font-mono text-stone-400 bg-white/80 px-2 py-1 rounded">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                </p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`rounded-2xl overflow-hidden border border-stone-100 bg-stone-100 ${className}`}
            style={{ height }}
            aria-label={`Map: ${locationLabel ?? "Property location"}`}
        />
    );
}
