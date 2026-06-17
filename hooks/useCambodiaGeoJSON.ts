import { useState, useEffect } from 'react';
import { GEOJSON_URLS } from '../utils/mapUtils';
import { CacheService, CACHE_KEYS } from '../services/cacheService';
import { cambodiaGeoJSON as localGeoJSON } from '../data/cambodia-map/cambodia-geojson';

// Convert the local TypeScript GeoJSON (which has name_en/name_km props) into the
// format ProvincialMap expects (shapeName, name_kh properties).
const normalizeLocalGeoJSON = (raw: typeof localGeoJSON): any => ({
    type: 'FeatureCollection',
    features: raw.features.map((f: any) => ({
        ...f,
        properties: {
            ...f.properties,
            // ProvincialMap checks: name_kh, Name_KH, name_en, Name_EN, name, shapeName
            shapeName: f.properties.name_en,
            name_kh:   f.properties.name_km,
        },
    })),
});

const LOCAL_GEOJSON = normalizeLocalGeoJSON(localGeoJSON);

export const useCambodiaGeoJSON = () => {
    // Start with local data immediately — map always renders on first paint
    const [geoJson, setGeoJson] = useState<any>(LOCAL_GEOJSON);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false); // not loading — local data is ready

    useEffect(() => {
        let isMounted = true;

        const fetchHighRes = async () => {
            // 1. Try cache first (stale-while-revalidate)
            try {
                const cached = await CacheService.get<any>(CACHE_KEYS.GEOJSON);
                if (cached && cached.type === 'FeatureCollection' && Array.isArray(cached.features)) {
                    if (isMounted) setGeoJson(cached);
                }
            } catch {
                // cache miss — continue to network
            }

            // 2. Fetch high-res data from external sources
            for (const url of GEOJSON_URLS) {
                try {
                    const res = await fetch(url, { signal: AbortSignal.timeout?.(8000) });
                    if (!res.ok) continue;
                    const data = await res.json();
                    if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) {
                        if (isMounted) setGeoJson(data);
                        await CacheService.set(CACHE_KEYS.GEOJSON, data);
                        return; // success — stop trying
                    }
                } catch {
                    // network error / timeout — try next URL
                }
            }
            // All external sources failed — local data remains active (no error shown)
        };

        fetchHighRes();

        return () => {
            isMounted = false;
        };
    }, []);

    return { geoJson, loading, error };
};
