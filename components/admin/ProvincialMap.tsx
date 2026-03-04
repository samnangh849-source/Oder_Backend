
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useCambodiaGeoJSON } from '../../hooks/useCambodiaGeoJSON';
import { normalizeName } from '../../utils/mapUtils';
import MapLegend from './map/MapLegend';
import { useMapEngine } from '../../hooks/useMapEngine';
import { EXTRUSION_HEIGHT_EXPRESSION, FILL_COLOR_EXPRESSION, MAP_COLORS } from './map/mapStyles';

interface ProvinceStat {
    name: string;
    revenue: number;
    orders: number;
    shippingCost?: number;
}

interface ProvincialMapProps {
    data: ProvinceStat[];
    onProvinceClick?: (provinceName: string) => void;
}

const ProvincialMap: React.FC<ProvincialMapProps> = ({ data, onProvinceClick }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]); 
    const labelMarkersRef = useRef<any[]>([]); // New ref for label markers
    const hoverStateIdRef = useRef<string | number | null>(null);
    const animationRef = useRef<number | null>(null);

    const [activeMetric, setActiveMetric] = useState<'revenue' | 'orders' | 'shipping'>('revenue');
    const [language, setLanguage] = useState<'en' | 'km'>('km'); // Default to Khmer
    const isUserInteracting = useRef(false);

    const { geoJson: rawGeoJson, loading: geoLoading, error: geoError } = useCambodiaGeoJSON();
    const { map, isMapReady, mapError } = useMapEngine(mapContainerRef);

    // Khmer Name Mapping
    const PROVINCE_NAME_MAP: Record<string, string> = {
        'phnompenh': 'រាជធានីភ្នំពេញ',
        'kandal': 'ខេត្ដកណ្តាល',
        'kampongcham': 'ខេត្ដកំពង់ចាម',
        'kampongchhnang': 'ខេត្ដកំពង់ឆ្នាំង',
        'kampongthom': 'ខេត្ដកំពង់ធំ',
        'kampongspeu': 'ខេត្ដកំពង់ស្ពឺ',
        'kampot': 'ខេត្ដកំពត',
        'kep': 'ខេត្ដកែប',
        'kohkong': 'ខេត្ដកោះកុង',
        'kratie': 'ខេត្ដក្រចេះ',
        'takeo': 'ខេត្ដតាកែវ',
        'tbongkhmum': 'ខេត្ដត្បូងឃ្មុំ',
        'banteymeanchey': 'ខេត្ដបន្ទាយមានជ័យ',
        'battambang': 'ខេត្ដបាត់ដំបង',
        'pailin': 'ខេត្ដប៉ៃលិន',
        'pursat': 'ខេត្ដពោធិ៍សាត់',
        'preyveng': 'ខេត្ដព្រៃវែង',
        'preahvihear': 'ខេត្ដព្រះវិហារ',
        'preahsihanouk': 'ខេត្ដព្រះសីហនុ',
        'mondulkiri': 'ខេត្ដមណ្ឌលគិរី',
        'ratanakiri': 'ខេត្ដរតនគិរី',
        'siemreap': 'ខេត្ដសៀមរាប',
        'stungtreng': 'ខេត្ដស្ទឹងត្រែង',
        'svayrieng': 'ខេត្ដស្វាយរៀង',
        'oddarmeanchey': 'ខេត្ដឧត្តរមានជ័យ'
    };

    const statsMap = useMemo(() => {
        const stats: Record<string, ProvinceStat> = {};
        if (!Array.isArray(data)) return stats;
        data.forEach(item => {
            if (!item || !item.name) return;
            const key = normalizeName(item.name);
            if (!key) return;
            if (!stats[key]) {
                stats[key] = { ...item, shippingCost: Number(item.shippingCost) || 0 };
            } else {
                stats[key].revenue += (Number(item.revenue) || 0);
                stats[key].orders += (Number(item.orders) || 0);
                stats[key].shippingCost = (stats[key].shippingCost || 0) + (Number(item.shippingCost) || 0);
            }
        });
        return stats;
    }, [data]);

    const topRanks = useMemo(() => {
        const sorted = Object.values(statsMap).sort((a, b) => {
            const valA = a[activeMetric as keyof ProvinceStat] || 0;
            const valB = b[activeMetric as keyof ProvinceStat] || 0;
            // @ts-ignore
            return valB - valA;
        });
        const ranks: Record<string, number> = {};
        sorted.forEach((item, index) => {
            const key = normalizeName(item.name);
            if (key) ranks[key] = index + 1;
        });
        return ranks;
    }, [statsMap, activeMetric]);

    // Colors - Solid Cyber
    const getMetricColor = () => {
        switch(activeMetric) {
            case 'revenue': return '#00bcd4'; // Cyan
            case 'orders': return '#8b5cf6'; // Violet
            case 'shipping': return '#10b981'; // Emerald
            default: return '#00bcd4';
        }
    };

    useEffect(() => {
        if (!isMapReady || !map || !rawGeoJson) return;

        try {
            // @ts-ignore
            const maplibregl = window.maplibregl;

            const pauseAnimation = () => { isUserInteracting.current = true; };
            const resumeAnimation = () => { isUserInteracting.current = false; };
            
            map.on('mousedown', pauseAnimation);
            map.on('touchstart', pauseAnimation);
            map.on('dragstart', pauseAnimation);
            map.on('mouseup', resumeAnimation);
            map.on('touchend', resumeAnimation);
            map.on('dragend', resumeAnimation);
            map.on('zoomstart', pauseAnimation);
            map.on('zoomend', resumeAnimation);

            if (!animationRef.current) { 
                 map.flyTo({
                    center: [104.9160, 12.6], 
                    zoom: 7.2, 
                    pitch: 50, // Slightly higher for 3D feel
                    bearing: -5,
                    speed: 0.8,
                    curve: 1.2,
                    essential: true
                });
            }

            const animateCamera = (timestamp: number) => {
                map.setLight({
                    anchor: 'map',
                    color: '#ffffff',
                    intensity: 0.6, 
                    position: [1.5, 1.5, 80] 
                });

                if (!isUserInteracting.current) {
                    const movePhase = timestamp / 20000;
                    const newBearing = -5 + Math.sin(movePhase) * 3; 
                    map.jumpTo({ bearing: newBearing });
                }

                animationRef.current = requestAnimationFrame(animateCamera);
            };
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            animationRef.current = requestAnimationFrame(animateCamera);

            if (map.setFog) {
                map.setFog({
                    'range': [1, 10],
                    'color': '#0f172a', // Dark Slate
                    'horizon-blend': 0.2,
                    'high-color': '#1e293b',
                    'space-color': '#0f172a',
                    'star-intensity': 0
                });
            }

            const processedFeatures = rawGeoJson.features.map((feature: any) => {
                const props = feature.properties || {};
                const namesToTry = [props.name_kh, props.Name_KH, props.name_en, props.Name_EN, props.name, props.shapeName];
                let revenue = 0;
                let orders = 0;
                let shippingCost = 0;
                let rank = 999;
                let key = '';

                // First Pass: Identify the province key from available names
                for (const n of namesToTry) {
                    if (!n) continue;
                    const normalized = normalizeName(String(n));
                    if (statsMap[normalized]) {
                        key = normalized;
                        revenue = statsMap[key].revenue;
                        orders = statsMap[key].orders;
                        shippingCost = statsMap[key].shippingCost || 0;
                        if (topRanks[key]) rank = topRanks[key];
                        break;
                    } else if (PROVINCE_NAME_MAP[normalized]) {
                         // Even if no stats, we might recognize the name
                         key = normalized;
                    }
                }
                
                // Fallback key if not found in stats
                if (!key && props.shapeName) key = normalizeName(props.shapeName);

                // Determine Display Name based on Language
                let displayName = props.name_en || props.shapeName || "Province";
                if (language === 'km' && key && PROVINCE_NAME_MAP[key]) {
                    displayName = PROVINCE_NAME_MAP[key];
                } else if (language === 'en' && props.shapeName) {
                    displayName = props.shapeName;
                }

                let visualValue = revenue;
                if (activeMetric === 'orders') visualValue = orders * 80; 
                if (activeMetric === 'shipping') visualValue = shippingCost * 25;

                return { 
                    ...feature, 
                    properties: { 
                        ...props, 
                        revenue: visualValue, 
                        realRevenue: revenue,
                        orders, 
                        shippingCost,
                        displayName, 
                        rank 
                    } 
                };
            });

            const processedGeoJson = { type: 'FeatureCollection', features: processedFeatures };
            const source = map.getSource('cambodia-3d-source');
            
            if (source) {
                source.setData(processedGeoJson);
            } else {
                map.addSource('cambodia-3d-source', {
                    type: 'geojson',
                    data: processedGeoJson,
                    generateId: true
                });

                // Layers...
                
                // 1. Solid Base 3D
                map.addLayer({
                    'id': 'province-3d',
                    'type': 'fill-extrusion',
                    'source': 'cambodia-3d-source',
                    'paint': {
                        'fill-extrusion-color': FILL_COLOR_EXPRESSION,
                        'fill-extrusion-height': EXTRUSION_HEIGHT_EXPRESSION,
                        'fill-extrusion-base': 0,
                        'fill-extrusion-opacity': 1, // Solid Opacity for 3D look
                        'fill-extrusion-vertical-gradient': true
                    }
                });
                
                // 2. Glowing Edges
                map.addLayer({
                    'id': 'province-outlines',
                    'type': 'line',
                    'source': 'cambodia-3d-source',
                    'paint': {
                        'line-color': getMetricColor(),
                        'line-width': 1.5,
                        'line-opacity': 0.5
                    }
                });

                // 3. Highlight Top
                map.addLayer({
                    'id': 'province-highlight',
                    'type': 'fill-extrusion',
                    'source': 'cambodia-3d-source',
                    'paint': {
                        'fill-extrusion-color': getMetricColor(),
                        'fill-extrusion-height': ['+', EXTRUSION_HEIGHT_EXPRESSION, 100], // Slightly higher to pop
                        'fill-extrusion-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 0]
                    }
                });

                popupRef.current = new maplibregl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    className: 'custom-map-popup',
                    offset: 80,
                    maxWidth: '300px'
                });

                map.on('mousemove', 'province-3d', (e: any) => {
                     if (e.features.length > 0) {
                        map.getCanvas().style.cursor = 'pointer';
                        const feature = e.features[0];
                        
                        if (hoverStateIdRef.current !== null) {
                            map.setFeatureState({ source: 'cambodia-3d-source', id: hoverStateIdRef.current }, { hover: false });
                        }
                        hoverStateIdRef.current = feature.id;
                        map.setFeatureState({ source: 'cambodia-3d-source', id: feature.id }, { hover: true });

                        const { displayName, realRevenue, orders, shippingCost } = feature.properties;
                        
                        let mainValue = `$${Number(realRevenue).toLocaleString()}`;
                        let ordersValue = `${orders}`;
                        
                        popupRef.current
                            .setLngLat(e.lngLat)
                            .setHTML(`
                                <div class="bg-slate-900 border border-slate-700 p-3 shadow-xl rounded-lg min-w-[160px]">
                                    <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                                        <h4 class="text-white font-bold text-xs uppercase">${displayName}</h4>
                                    </div>
                                    <div class="flex flex-col gap-2">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] text-gray-400 uppercase">ORDERS</span>
                                            <span class="text-sm font-bold text-violet-400">${ordersValue}</span>
                                        </div>
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] text-gray-400 uppercase">REVENUE</span>
                                            <span class="text-sm font-bold text-cyan-400">${mainValue}</span>
                                        </div>
                                        <div class="pt-1 mt-1 border-t border-slate-800 text-[10px] text-center text-cyan-500 font-bold uppercase cursor-pointer">
                                            Click to view details
                                        </div>
                                    </div>
                                </div>
                            `)
                            .addTo(map);
                    }
                });

                map.on('click', 'province-3d', (e: any) => {
                    if (e.features.length > 0) {
                        const feature = e.features[0];
                        const { displayName } = feature.properties;
                        if (onProvinceClick) {
                            onProvinceClick(displayName);
                        }
                    }
                });
                
                map.on('mouseleave', 'province-3d', () => {
                    map.getCanvas().style.cursor = '';
                    if (hoverStateIdRef.current !== null) {
                        map.setFeatureState({ source: 'cambodia-3d-source', id: hoverStateIdRef.current }, { hover: false });
                    }
                    hoverStateIdRef.current = null;
                    popupRef.current.remove();
                });
            }
            
            if (map.getLayer('province-outlines')) {
                map.setPaintProperty('province-outlines', 'line-color', getMetricColor());
            }
            if (map.getLayer('province-highlight')) {
                map.setPaintProperty('province-highlight', 'fill-extrusion-color', getMetricColor());
            }

            // Helper to find largest polygon in a MultiPolygon
            const getLargestPolygon = (geometry: any) => {
                if (geometry.type === 'Polygon') return geometry.coordinates[0];
                let largest = geometry.coordinates[0][0];
                let maxLen = 0;
                geometry.coordinates.forEach((poly: any) => {
                    if (poly[0].length > maxLen) {
                        maxLen = poly[0].length;
                        largest = poly[0];
                    }
                });
                return largest;
            };

            // Helper to calculate polygon centroid (Center of Mass)
            const getPolygonCentroid = (pts: [number, number][]) => {
                if (!pts || pts.length === 0) return [0, 0];
                let points = [...pts];
                let first = points[0], last = points[points.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) points.push(first);
                let twicearea = 0, x = 0, y = 0, nPts = points.length, p1, p2, f;
                for (let i = 0, j = nPts - 1; i < nPts; j = i++) {
                    p1 = points[i]; p2 = points[j];
                    f = p1[0] * p2[1] - p2[0] * p1[1];
                    twicearea += f;
                    x += (p1[0] + p2[0]) * f;
                    y += (p1[1] + p2[1]) * f;
                }
                f = twicearea * 3;
                if (f === 0 || isNaN(x/f) || isNaN(y/f)) {
                    // Fallback to bounding box center
                    const bounds = new maplibregl.LngLatBounds(pts[0], pts[0]);
                    pts.forEach(coord => bounds.extend(coord as [number, number]));
                    const c = bounds.getCenter();
                    return [c.lng, c.lat];
                }
                return [x / f, y / f];
            };

            // Manual offsets for tricky provinces (e.g. Kandal wrapping around PP)
            const PROVINCE_OFFSETS: Record<string, [number, number]> = {
                'kandal': [0, -0.3], // Shift Kandal label South
                'kampongthom': [-0.1, 0.1] // Shift slightly Northwest
            };

            // --- FIXED LABELS (Using Markers instead of Layer for better 3D positioning) ---
            // Remove old label markers
            labelMarkersRef.current.forEach(marker => marker.remove());
            labelMarkersRef.current = [];

            // Add new label markers for ALL provinces
            processedFeatures.forEach((feature: any) => {
                const { displayName } = feature.properties;
                const coords = getLargestPolygon(feature.geometry);
                
                if (!coords) return;
                const centroid = getPolygonCentroid(coords);
                
                // Apply manual offset if needed
                const provKey = feature.properties.shapeName ? normalizeName(feature.properties.shapeName) : '';
                const offset = provKey && PROVINCE_OFFSETS[provKey] ? PROVINCE_OFFSETS[provKey] : [0, 0];
                
                const finalCenter = { lng: centroid[0] + offset[0], lat: centroid[1] + offset[1] };

                const el = document.createElement('div');
                el.className = 'province-label-marker';
                el.innerHTML = `<span class="text-[8px] font-bold text-white/50 uppercase tracking-wider drop-shadow-md select-none hover:text-white transition-colors">${displayName}</span>`;
                
                // Add marker
                const marker = new maplibregl.Marker({
                    element: el,
                    anchor: 'center',
                })
                .setLngLat(finalCenter)
                .addTo(map);
                
                labelMarkersRef.current.push(marker);
            });

            // --- RANK MARKERS (Keep existing) ---
            markersRef.current.forEach(marker => marker.remove());
            markersRef.current = [];
            processedFeatures.forEach((feature: any) => {
                const { rank, displayName, realRevenue, orders, shippingCost } = feature.properties;
                if (rank && rank <= 3) {
                    const coords = getLargestPolygon(feature.geometry);
                    if (!coords) return;
                    
                    const centroid = getPolygonCentroid(coords);
                    const provKey = feature.properties.shapeName ? normalizeName(feature.properties.shapeName) : '';
                    const offset = provKey && PROVINCE_OFFSETS[provKey] ? PROVINCE_OFFSETS[provKey] : [0, 0];
                    const finalCenter = { lng: centroid[0] + offset[0], lat: centroid[1] + offset[1] };

                    const el = document.createElement('div');
                    el.className = 'province-rank-marker';
                    
                    let displayValue = `$${(realRevenue/1000).toFixed(1)}k`;
                    if (activeMetric === 'orders') displayValue = `${orders}`;
                    if (activeMetric === 'shipping') displayValue = `$${(shippingCost/1000).toFixed(1)}k`;

                    el.innerHTML = `
                        <div class="flex flex-col items-center group cursor-pointer animate-float hover:z-50">
                            <div class="px-3 py-1 bg-slate-900/90 border border-white/20 rounded-lg flex items-center gap-2 shadow-lg mb-1 backdrop-blur-sm">
                                <span class="text-[10px] font-black text-yellow-400">#${rank}</span>
                                <span class="text-[9px] font-bold text-white uppercase">${displayName}</span>
                            </div>
                            <div class="w-0.5 h-10 bg-white/50"></div>
                            <div class="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                    `;
                    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -10] }).setLngLat(finalCenter).addTo(map);
                    markersRef.current.push(marker);
                }
            });

        } catch (e) {
            console.error("Layer Update Error:", e);
        }
        return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    }, [isMapReady, rawGeoJson, statsMap, topRanks, activeMetric, language, onProvinceClick]); 

    if (geoError || mapError) {
        return (
            <div className="w-full h-[500px] flex items-center justify-center bg-gray-900/50 rounded-3xl border border-red-500/20 text-red-400">
                <p>Map Error: {geoError || mapError}</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[650px] xl:h-[750px] bg-slate-950 rounded-lg border border-slate-800 shadow-2xl overflow-hidden group">
            
            {/* Header */}
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-cyan-500 animate-pulse rounded-full"></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">3D Visualization</span>
                    </div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Cambodia <span className="text-cyan-400">Map</span></h2>
                </div>
            </div>

            {/* CONTROL PANEL */}
            <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
                 {[
                     { id: 'revenue', label: 'Revenue', color: 'bg-cyan-600' },
                     { id: 'orders', label: 'Orders', color: 'bg-violet-600' },
                     { id: 'shipping', label: 'Shipping', color: 'bg-emerald-600' }
                 ].map((item) => (
                     <button 
                        key={item.id}
                        // @ts-ignore
                        onClick={() => setActiveMetric(item.id)}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all w-24 text-center ${activeMetric === item.id ? `${item.color} text-white shadow-lg` : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                     >
                        {item.label}
                     </button>
                 ))}

                 {/* Language Toggle */}
                 <div className="mt-2 pt-2 border-t border-slate-700 flex flex-col gap-1">
                    <button 
                        onClick={() => setLanguage(l => l === 'km' ? 'en' : 'km')}
                        className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all w-24 text-center bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700 hover:border-slate-600"
                    >
                        {language === 'km' ? '🇰🇭 KHM' : '🇺🇸 ENG'}
                    </button>
                 </div>
            </div>

            <div ref={mapContainerRef} className="w-full h-full relative z-1" />
            
            {(!isMapReady || geoLoading) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
                    <div className="text-slate-500 font-bold text-xs animate-pulse">LOADING MAP...</div>
                </div>
            )}

            <MapLegend />
            
            <style>{`
                .maplibregl-popup { z-index: 100; }
                .maplibregl-popup-content { background: transparent !important; box-shadow: none !important; padding: 0 !important; border: none !important; }
                .maplibregl-popup-tip { display: none !important; }
                .province-rank-marker { z-index: 10; pointer-events: none; }
                .province-label-marker { z-index: 5; pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
                
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-float {
                    animation: float 4s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default ProvincialMap;
