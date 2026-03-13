import { useState, useEffect } from 'react';
import { GEOJSON_URLS } from '../utils/mapUtils';
import { CacheService, CACHE_KEYS } from '../services/cacheService';

export const useCambodiaGeoJSON = () => {
    const [geoJson, setGeoJson] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchGeoJSON = async () => {
            // 1. Try Cache First
            try {
                const cached = await CacheService.get<any>(CACHE_KEYS.GEOJSON);
                if (cached && cached.type === 'FeatureCollection') {
                    if (isMounted) {
                        setGeoJson(cached);
                        setLoading(false);
                    }
                    // Continue to revalidate in background (Stale-While-Revalidate)
                }
            } catch (e) {
                console.warn("GeoJSON Cache read failed", e);
            }

            // 2. Fetch from multiple sources until one succeeds
            for (const url of GEOJSON_URLS) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        // Validate that the data is actually a GeoJSON feature collection
                        if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
                            if (isMounted) {
                                setGeoJson(data);
                                setLoading(false);
                                // Save to Cache
                                await CacheService.set(CACHE_KEYS.GEOJSON, data);
                            }
                            return;
                        } else {
                            console.warn(`Fetched data from ${url} is not valid GeoJSON`);
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to load ${url}`, e);
                }
            }

            if (isMounted && !geoJson) {
                setError("មិនអាចទាញយកទិន្នន័យផែនទីបានទេ");
                setLoading(false);
            }
        };

        fetchGeoJSON().catch(err => {
            console.error("GeoJSON Fetch Fatal Error:", err);
            if (isMounted) {
                setError("Error loading map data");
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
        };
    }, []);

    return { geoJson, loading, error };
};
