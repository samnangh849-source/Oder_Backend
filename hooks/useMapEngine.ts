
import { useEffect, useRef, useState, MutableRefObject } from 'react';

export const useMapEngine = (containerRef: MutableRefObject<HTMLDivElement | null>) => {
    const mapRef = useRef<any>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        let mapInstance: any = null;

        const initializeMap = async () => {
            if (!containerRef.current) return;
            if (mapRef.current) return; // Prevent double init

            try {
                // Wait for MapLibre to be available in global scope
                let attempts = 0;
                // @ts-ignore
                while (!window.maplibregl && attempts < 50) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }

                if (!isMounted) return;
                // @ts-ignore
                const maplibregl = window.maplibregl;
                if (!maplibregl) throw new Error("MapLibre GL library not found.");

                mapInstance = new maplibregl.Map({
                    container: containerRef.current,
                    style: {
                        version: 8,
                        sources: {
                            'osm': {
                                type: 'raster',
                                tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
                                tileSize: 256,
                                attribution: '&copy; OpenStreetMap & CartoDB'
                            }
                        },
                        layers: [
                            {
                                id: 'background',
                                type: 'background',
                                paint: { 'background-color': '#020617' }
                            },
                            {
                                id: 'osm-layer',
                                type: 'raster',
                                source: 'osm',
                                paint: { 'raster-opacity': 0.3, 'raster-saturation': -1, 'raster-contrast': 0.1 }
                            }
                        ]
                    },
                    center: [104.9160, 12.5657], // Center of Cambodia
                    zoom: 6.6,
                    pitch: 45, // 3D View Angle
                    bearing: -10, // Slight Rotation
                    minZoom: 3,
                    maxZoom: 18,
                    interactive: true,
                    scrollZoom: true,
                    dragPan: true,
                    dragRotate: true,
                    touchZoomRotate: true
                });

                mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');

                mapInstance.on('load', () => {
                    if (isMounted) {
                        mapRef.current = mapInstance;
                        setIsMapReady(true);
                        console.log("Map Engine Ready in 3D Mode");
                    }
                });

                mapInstance.on('error', (e: any) => {
                    console.error("Map Internal Error:", e);
                });

            } catch (err: any) {
                console.error("Map Engine Initialization Failed:", err);
                if (isMounted) setMapError(err.message);
            }
        };

        // Catch unhandled promise rejections from the async function
        initializeMap().catch(err => {
            console.error("Uncaught Map Engine Error:", err);
            if (isMounted) setMapError("Failed to initialize map engine.");
        });

        return () => {
            isMounted = false;
            if (mapInstance) {
                mapInstance.remove();
                mapRef.current = null;
            }
        };
    }, []);

    return { map: mapRef.current, isMapReady, mapError };
};
