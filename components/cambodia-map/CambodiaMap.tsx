import React, { useState, useMemo, useCallback, useRef, useEffect, useContext } from 'react';
import { cambodiaGeoJSON } from '../../data/cambodia-map/cambodia-geojson';
import provincesRaw from '../../data/cambodia-map/provinces.json';
import { ParsedOrder } from '../../types';
import {
  ProvinceData, MetricKey, Language, MetricConfig, METRICS, UI_TEXT,
  ProvinceOrderStats, MapKPIStats, TableSortKey, SortDirection,
} from './types';
import { useMapEngine } from '../../hooks/useMapEngine';
import { useCambodiaGeoJSON } from '../../hooks/useCambodiaGeoJSON';
import { EXTRUSION_HEIGHT_EXPRESSION, FILL_COLOR_EXPRESSION } from '../admin/map/mapStyles';
import { normalizeName } from '../../utils/mapUtils';
import { AppContext } from '../../context/AppContext';
import DateRangeFilter, { DateRangePreset } from '../common/DateRangeFilter';

const provinces: ProvinceData[] = provincesRaw.provinces;

interface CambodiaMapProps {
  onBack?: () => void;
  orders?: ParsedOrder[];
  themeMode?: 'light' | 'dark';
  // Filter props
  dateFilter?: { preset: DateRangePreset; start: string; end: string };
  setDateFilter?: (filter: any) => void;
  selectedTeam?: string;
  setSelectedTeam?: (team: string) => void;
  teams?: string[];
}

// Convert GeoJSON coordinates to SVG path
function coordsToPath(coords: number[][][], width: number, height: number): string {
  const minLng = 102.3, maxLng = 107.6;
  const minLat = 10.2, maxLat = 14.7;
  const padding = 20;

  const points = coords[0].map(([lng, lat]) => {
    const x = padding + ((lng - minLng) / (maxLng - minLng)) * (width - padding * 2);
    const y = padding + ((maxLat - lat) / (maxLat - minLat)) * (height - padding * 2);
    return `${x},${y}`;
  });

  return `M${points.join('L')}Z`;
}

function getMetricColor(value: number, min: number, max: number, colorRange: string[], invert: boolean = false): string {
  if (max === min) return colorRange[3];
  let ratio = (value - min) / (max - min);
  if (invert) ratio = 1 - ratio;
  const idx = Math.min(Math.floor(ratio * colorRange.length), colorRange.length - 1);
  return colorRange[idx];
}

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDate(ts: string): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch {
    return ts.slice(0, 10);
  }
}

interface TooltipData {
  province: ProvinceData;
  x: number;
  y: number;
}

const CambodiaMap: React.FC<CambodiaMapProps> = ({ onBack, orders, themeMode, dateFilter, setDateFilter, selectedTeam, setSelectedTeam, teams }) => {
  const { appData } = useContext(AppContext);
  const [language, setLanguage] = useState<Language>('km');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('revenue');
  const [selectedProvince, setSelectedProvince] = useState<ProvinceData | null>(null);

  // ---- Sheet-based Province Mapping ----
  // Create a mapping from normalized English names to Khmer names found in the 'Location' sheet
  const sheetProvinceMap = useMemo(() => {
    const mapping: Record<string, string> = {};
    if (!appData?.locations) return mapping;

    // appData.locations contains rows with Province, District, Sangkat
    // We assume the 'Province' column contains the Khmer name the user wants
    appData.locations.forEach(loc => {
      const khName = loc.Province;
      const normalizedEN = normalizeName(khName); // normalizeName can map KH -> EN-normalized
      if (normalizedEN && !mapping[normalizedEN]) {
        mapping[normalizedEN] = khName;
      }
    });
    return mapping;
  }, [appData?.locations]);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [tableSortKey, setTableSortKey] = useState<TableSortKey>('revenue');
  const [tableSortDir, setTableSortDir] = useState<SortDirection>('desc');
  const [tableShowAll, setTableShowAll] = useState(false);
  const [isRealMapMode, setIsRealMapMode] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // MapLibre Hooks
  const { geoJson: rawGeoJson } = useCambodiaGeoJSON();
  const { map, isMapReady } = useMapEngine(mapContainerRef);
  const hoverStateIdRef = useRef<string | number | null>(null);
  const labelMarkersRef = useRef<any[]>([]);

  const isDark = themeMode !== 'light'; // Binance is always dark by default

  const themeVars: React.CSSProperties = {
    '--cm-bg': '#050505',
    '--cm-card-bg': '#121212',
    '--cm-card-bg2': '#080808',
    '--cm-border': '#1A1A1A',
    '--cm-border-subtle': 'rgba(43,49,57,0.6)',
    '--cm-text-primary': '#EAECEF',
    '--cm-text-secondary': '#B7BDC6',
    '--cm-text-muted': '#707A8A',
    '--cm-accent': '#F0B90B',
    '--cm-accent-hover': '#D4A50A',
    '--cm-accent-light': 'rgba(240,185,11,0.1)',
    '--cm-accent-border': 'rgba(240,185,11,0.25)',
    '--cm-hover': '#2B3139',
    '--cm-input-bg': '#14161A',
    '--cm-shadow': '0 1px 3px rgba(0,0,0,0.5)',
    '--cm-shadow-lg': '0 8px 24px rgba(0,0,0,0.7)',
    '--cm-radius': '2px',
    '--cm-radius-lg': '4px',
    '--cm-green': '#0ECB81',
    '--cm-green-bg': 'rgba(14,203,129,0.12)',
    '--cm-green-border': 'rgba(14,203,129,0.25)',
    '--cm-red': '#F6465D',
    '--cm-red-bg': 'rgba(246,70,93,0.12)',
    '--cm-svg-stroke': '#0B0E11',
    '--cm-chart-grid': 'rgba(43,49,57,0.5)',
  } as React.CSSProperties;

  const t = useCallback((key: string) => {
    const kmKey = `${key}_km`;
    const enKey = `${key}_en`;
    return language === 'km' ? (UI_TEXT as any)[kmKey] : (UI_TEXT as any)[enKey];
  }, [language]);

  const metricConfig: MetricConfig = METRICS[selectedMetric];

  // ---- Order Stats Computation ----
  const provinceOrderStats = useMemo((): Record<string, ProvinceOrderStats> => {
    const statsMap: Record<string, ProvinceOrderStats> = {};
    provinces.forEach(p => {
      statsMap[p.province_id] = {
        province_id: p.province_id,
        name_en: p.name_en,
        name_km: p.name_km,
        revenue: 0,
        orders_count: 0,
        paid_count: 0,
        unpaid_count: 0,
        delivered_count: 0,
        pending_count: 0,
        top_user: '',
        recent_orders: [],
      };
    });

    if (!orders || orders.length === 0) return statsMap;

    const userFreq: Record<string, Record<string, number>> = {};
    const recentBuf: Record<string, { order_id: string; timestamp: string; grand_total: number; payment_status: string; fulfillment_status: string; user: string }[]> = {};

    orders.forEach(order => {
      const rawProvince = (order.Location || '').split(',')[0].trim();
      if (!rawProvince) return;

      const normalizedInput = normalizeName(rawProvince);
      
      let matched = provinces.find(p => normalizeName(p.name_en) === normalizedInput);
      if (!matched) {
        matched = provinces.find(p =>
          normalizeName(p.name_en).includes(normalizedInput) ||
          normalizedInput.includes(normalizeName(p.name_en))
        );
      }
      if (!matched) return;

      const stat = statsMap[matched.province_id];
      const grandTotal = Number(order['Grand Total']) || 0;

      stat.revenue += grandTotal;
      stat.orders_count += 1;

      const ps = (order['Payment Status'] || '').toLowerCase();
      if (ps === 'paid') stat.paid_count++;
      else stat.unpaid_count++;

      const fs = order.FulfillmentStatus || '';
      if (fs === 'Delivered') stat.delivered_count++;
      else if (fs !== 'Cancelled') stat.pending_count++;

      const user = order.User || 'Unknown';
      if (!userFreq[matched.province_id]) userFreq[matched.province_id] = {};
      userFreq[matched.province_id][user] = (userFreq[matched.province_id][user] || 0) + 1;

      if (!recentBuf[matched.province_id]) recentBuf[matched.province_id] = [];
      recentBuf[matched.province_id].push({
        order_id: order['Order ID'] || '',
        timestamp: order.Timestamp || '',
        grand_total: grandTotal,
        payment_status: order['Payment Status'] || '',
        fulfillment_status: fs,
        user,
      });
    });

    Object.entries(userFreq).forEach(([pid, freq]) => {
      const topUser = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      statsMap[pid].top_user = topUser;
    });

    Object.entries(recentBuf).forEach(([pid, buf]) => {
      buf.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      statsMap[pid].recent_orders = buf.slice(0, 5);
    });

    return statsMap;
  }, [orders]);

  // ---- KPI Stats ----
  const kpiStats = useMemo((): MapKPIStats => {
    const statsArr: ProvinceOrderStats[] = Object.values(provinceOrderStats);
    const total_orders = statsArr.reduce((s, p) => s + p.orders_count, 0);
    const total_revenue = statsArr.reduce((s, p) => s + p.revenue, 0);
    const active = statsArr.filter(s => s.orders_count > 0);
    const topProv = [...active].sort((a, b) => b.revenue - a.revenue)[0];
    return {
      total_orders,
      total_revenue,
      top_province_name: topProv ? (language === 'km' ? topProv.name_km : topProv.name_en) : '—',
      top_province_revenue: topProv?.revenue ?? 0,
      covered_provinces: active.length,
    };
  }, [provinceOrderStats, language]);

  // ---- Sorted table data ----
  const sortedTableData = useMemo((): ProvinceOrderStats[] => {
    let rows: ProvinceOrderStats[] = Object.values(provinceOrderStats);
    if (!tableShowAll) {
      // Show top 10 instead of filtering out 0-order provinces entirely to keep it interactive
      rows = rows.filter(r => r.orders_count > 0);
      if (rows.length === 0) rows = (Object.values(provinceOrderStats) as ProvinceOrderStats[]).slice(0, 10);
    }
    rows = [...rows].sort((a, b) => {
      let va = 0, vb = 0;
      switch (tableSortKey) {
        case 'name':
          return tableSortDir === 'asc'
            ? a.name_en.localeCompare(b.name_en)
            : b.name_en.localeCompare(a.name_en);
        case 'orders_count': va = a.orders_count; vb = b.orders_count; break;
        case 'revenue': va = a.revenue; vb = b.revenue; break;
        case 'paid_pct':
          va = a.orders_count ? a.paid_count / a.orders_count : 0;
          vb = b.orders_count ? b.paid_count / b.orders_count : 0;
          break;
        case 'delivered_pct':
          va = a.orders_count ? a.delivered_count / a.orders_count : 0;
          vb = b.orders_count ? b.delivered_count / b.orders_count : 0;
          break;
      }
      return tableSortDir === 'asc' ? va - vb : vb - va;
    });
    return rows;
  }, [provinceOrderStats, tableSortKey, tableSortDir, tableShowAll]);

  // ---- Metric min/max ----
  const { metricMin, metricMax } = useMemo(() => {
    const isOrderMetric = selectedMetric === 'revenue' || selectedMetric === 'orders_count';
    let values: number[];
    if (isOrderMetric) {
      values = provinces.map(p => {
        const stat = provinceOrderStats[p.province_id];
        return stat ? (selectedMetric === 'revenue' ? stat.revenue : stat.orders_count) : 0;
      });
    } else {
      values = provinces.map(p => p[selectedMetric as keyof ProvinceData] as number);
    }
    return { metricMin: Math.min(...values), metricMax: Math.max(...values) };
  }, [selectedMetric, provinceOrderStats]);

  // Build path data for each province
  const pathData = useMemo(() => {
    const svgWidth = 600;
    const svgHeight = 520;
    return cambodiaGeoJSON.features.map((feature) => {
      const province = provinces.find(p => p.province_id === feature.properties.province_id);
      if (!province) return null;
      const path = coordsToPath(feature.geometry.coordinates, svgWidth, svgHeight);
      return { path, province, feature };
    }).filter(Boolean) as { path: string; province: ProvinceData; feature: any }[];
  }, []);

  // Filtered provinces for search
  const filteredProvinces = useMemo(() => {
    if (!searchQuery.trim()) return provinces;
    const q = searchQuery.toLowerCase();
    return provinces.filter(p =>
      p.name_en.toLowerCase().includes(q) ||
      p.name_km.includes(searchQuery) ||
      p.capital_en.toLowerCase().includes(q) ||
      p.capital.includes(searchQuery)
    );
  }, [searchQuery]);

  const handleProvinceClick = useCallback((province: ProvinceData) => {
    setSelectedProvince(prev => prev?.province_id === province.province_id ? null : province);
  }, []);

  const handleProvinceHover = useCallback((province: ProvinceData | null, e?: React.MouseEvent) => {
    setHoveredProvince(province?.province_id || null);
    if (province && e && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltipData({ province, x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else {
      setTooltipData(null);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (tooltipData && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltipData(prev => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
    }
  }, [tooltipData]);

  const handleTableSort = (key: TableSortKey) => {
    if (key === tableSortKey) {
      setTableSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortKey(key);
      setTableSortDir('desc');
    }
  };

  // ---- 3D Map Engine Effect ----
  useEffect(() => {
    if (!isRealMapMode || !isMapReady || !map || !rawGeoJson) return;

    try {
      // @ts-ignore
      const maplibregl = window.maplibregl;

      const processedFeatures = rawGeoJson.features.map((feature: any) => {
        const props = feature.properties || {};
        const pId = props.province_id || props.id;
        
        let stat = provinceOrderStats[pId];
        if (!stat) {
          // Fallback matching
          const shapeName = props.name_en || props.shapeName || props.Name_EN || '';
          const key = normalizeName(shapeName);
          const matchedId = Object.keys(provinceOrderStats).find(id => 
             normalizeName(provinceOrderStats[id].name_en) === key
          );
          if (matchedId) stat = provinceOrderStats[matchedId];
        }

        const revenue = stat?.revenue || 0;
        const ordersCount = stat?.orders_count || 0;
        
        // Robust Display Name matching
        const normalizedEN = normalizeName(stat?.name_en || props.name_en || props.shapeName || props.Name_EN || props.name || "");
        
        // Priority: 1. Sheet name (user-defined), 2. metadata, 3. feature props
        const sheetKH = normalizedEN ? sheetProvinceMap[normalizedEN] : null;
        const kmName = sheetKH || stat?.name_km || props.name_km || props.name_kh || props.Name_KH || props.name || "";
        const enName = stat?.name_en || props.name_en || props.shapeName || props.Name_EN || props.name || "";
        const displayName = language === 'km' ? (kmName || enName) : (enName || kmName);

        let visualValue = revenue;
        if (selectedMetric === 'orders_count') visualValue = ordersCount * 1000; // Scaling for 3D height
        else if (selectedMetric === 'population') visualValue = (stat ? provinces.find(p => p.province_id === stat.province_id)?.population : 0) || 0;

        return {
          ...feature,
          properties: {
            ...props,
            revenue: visualValue,
            realRevenue: revenue,
            orders: ordersCount,
            displayName: displayName || "Province"
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

        map.addLayer({
          'id': 'province-3d',
          'type': 'fill-extrusion',
          'source': 'cambodia-3d-source',
          'paint': {
            'fill-extrusion-color': FILL_COLOR_EXPRESSION,
            'fill-extrusion-height': EXTRUSION_HEIGHT_EXPRESSION,
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9,
            'fill-extrusion-vertical-gradient': true
          }
        });

        // Add distinct outlines
        map.addLayer({
          'id': 'province-outlines',
          'type': 'line',
          'source': 'cambodia-3d-source',
          'paint': {
            'line-color': '#ffffff',
            'line-width': 0.5,
            'line-opacity': 0.3
          }
        });

        // Add selection/hover highlight layer
        map.addLayer({
          'id': 'province-highlight',
          'type': 'fill-extrusion',
          'source': 'cambodia-3d-source',
          'paint': {
            'fill-extrusion-color': '#F0B90B',
            'fill-extrusion-height': ['+', EXTRUSION_HEIGHT_EXPRESSION, 500], // Pop up more
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.8
          },
          'filter': ['==', ['get', 'province_id'], ''] // Initially empty
        });

        map.on('mousemove', 'province-3d', (e: any) => {
          if (e.features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            const pId = feature.properties.province_id;

            if (hoverStateIdRef.current !== null) {
              map.setFeatureState({ source: 'cambodia-3d-source', id: hoverStateIdRef.current }, { hover: false });
            }
            hoverStateIdRef.current = feature.id;
            map.setFeatureState({ source: 'cambodia-3d-source', id: feature.id }, { hover: true });

            // Set tooltip data
            const p = provinces.find(p => p.province_id === pId);
            if (p) {
              setTooltipData({ province: p, x: e.point.x, y: e.point.y });
            }
          }
        });

        map.on('mouseleave', 'province-3d', () => {
          map.getCanvas().style.cursor = '';
          if (hoverStateIdRef.current !== null) {
            map.setFeatureState({ source: 'cambodia-3d-source', id: hoverStateIdRef.current }, { hover: false });
          }
          hoverStateIdRef.current = null;
          setTooltipData(null);
        });

        map.on('click', 'province-3d', (e: any) => {
          if (e.features.length > 0) {
            const feature = e.features[0];
            const pId = feature.properties.province_id;
            const p = provinces.find(p => p.province_id === pId);
            if (p) {
              handleProvinceClick(p);
              // Fly to the province
              map.flyTo({
                center: [e.lngLat.lng, e.lngLat.lat],
                zoom: 8.5,
                duration: 1500,
                essential: true
              });
            }
          }
        });
      }

      // Update highlight layer filter based on selection
      if (map.getLayer('province-highlight')) {
        map.setFilter('province-highlight', ['==', ['get', 'province_id'], selectedProvince?.province_id || '']);
      }

      // --- LABELS LOGIC ---
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
              const bounds = new maplibregl.LngLatBounds(pts[0], pts[0]);
              pts.forEach(coord => bounds.extend(coord as [number, number]));
              const c = bounds.getCenter();
              return [c.lng, c.lat];
          }
          return [x / f, y / f];
      };

      const PROVINCE_OFFSETS: Record<string, [number, number]> = {
          'KH-5': [0, -0.1], // Kandal
          'KH-1': [0, 0],    // PP
      };

      // Remove old labels
      labelMarkersRef.current.forEach(m => m.remove());
      labelMarkersRef.current = [];

      processedFeatures.forEach((feature: any) => {
          const { displayName, province_id } = feature.properties;
          const coords = getLargestPolygon(feature.geometry);
          if (!coords) return;
          
          const centroid = getPolygonCentroid(coords);
          const offset = PROVINCE_OFFSETS[province_id] || [0, 0];
          const finalCenter = { lng: centroid[0] + offset[0], lat: centroid[1] + offset[1] };

          const el = document.createElement('div');
          el.className = 'province-label-3d';
          el.innerHTML = `<span style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.8); text-transform: uppercase; text-shadow: 0 1px 4px rgba(0,0,0,1); pointer-events: none; white-space: nowrap;">${displayName}</span>`;
          
          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat(finalCenter)
              .addTo(map);
          
          labelMarkersRef.current.push(marker);
      });

    } catch (e) {
      console.error("3D Map Update Error:", e);
    }
  }, [isRealMapMode, isMapReady, map, rawGeoJson, provinceOrderStats, selectedMetric, language, handleProvinceClick, selectedProvince]);

  const getMetricValue = (province: ProvinceData): number => {
    if (selectedMetric === 'revenue') return provinceOrderStats[province.province_id]?.revenue ?? 0;
    if (selectedMetric === 'orders_count') return provinceOrderStats[province.province_id]?.orders_count ?? 0;
    return province[selectedMetric as keyof ProvinceData] as number;
  };

  const getPctBadgeClass = (pct: number) => {
    if (pct >= 0.8) return 'cm-pct-badge green';
    if (pct < 0.5) return 'cm-pct-badge red';
    return 'cm-pct-badge neutral';
  };

  const svgWidth = 600;
  const svgHeight = 520;

  return (
    <div
      className="cambodia-map-root"
      style={themeVars}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Khmer:wght@400;500;600;700&display=swap');

        .cambodia-map-root {
          font-family: 'Inter', 'Noto Sans Khmer', sans-serif;
          background: var(--cm-bg);
          color: var(--cm-text-primary);
          min-height: 100svh;
          width: 100%;
          overflow: hidden;
          position: relative;
        }

        /* ── Header ── */
        .cm-header {
          background: var(--cm-card-bg);
          border-bottom: 1px solid var(--cm-border);
          padding: 8px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 50;
          min-height: 52px;
          flex-shrink: 0;
          flex-wrap: wrap;
          gap: 12px;
        }
        @media (min-width: 1024px) {
          .cm-header { height: 64px; }
        }
        .cm-header-filter-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cm-team-select {
          background: #0B0E11;
          border: 1px solid #2B3139;
          color: #EAECEF;
          font-size: 11px;
          font-weight: 700;
          border-radius: 4px;
          padding: 4px 8px;
          outline: none;
          transition: border-color 0.2s;
          height: 32px;
        }
        .cm-team-select:focus { border-color: #F0B90B; }
        .cm-header-left {
          display: flex;
          align-items: center;
          gap: 0;
          height: 100%;
        }
        .cm-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-right: 20px;
          border-right: 1px solid var(--cm-border);
          height: 100%;
        }
        .cm-header-title h1 {
          font-size: 14px;
          font-weight: 700;
          margin: 0;
          color: var(--cm-text-primary);
          letter-spacing: 0.01em;
          white-space: nowrap;
        }
        .cm-logo-icon {
          width: 26px;
          height: 26px;
          background: var(--cm-accent);
          border-radius: var(--cm-radius);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          color: #1E2329;
          font-size: 10px;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }
        /* Metric tabs in header */
        .cm-metric-tabs {
          display: flex;
          align-items: center;
          height: 100%;
          padding: 0 8px;
          gap: 2px;
        }
        .cm-metric-tab {
          height: 100%;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--cm-text-muted);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-family: inherit;
          transition: color 0.1s, border-color 0.1s;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .cm-metric-tab:hover { color: var(--cm-text-primary); }
        .cm-metric-tab.active { color: var(--cm-accent); border-bottom-color: var(--cm-accent); }
        .cm-header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .cm-icon-btn {
          background: var(--cm-input-bg);
          border: 1px solid var(--cm-border);
          border-radius: var(--cm-radius);
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          color: var(--cm-text-secondary);
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.12s;
          font-family: inherit;
          letter-spacing: 0.04em;
        }
        .cm-icon-btn:hover { border-color: var(--cm-accent); color: var(--cm-accent); }

        /* ── KPI Ticker Bar ── */
        .cm-kpi-bar {
          display: flex;
          align-items: stretch;
          border-bottom: 1px solid var(--cm-border);
          background: var(--cm-card-bg2);
          overflow-x: auto;
        }
        .cm-kpi-bar::-webkit-scrollbar { display: none; }
        .cm-kpi-cell {
          padding: 10px 20px;
          border-right: 1px solid var(--cm-border);
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: fit-content;
          flex-shrink: 0;
        }
        .cm-kpi-cell:last-child { border-right: none; }
        .cm-kpi-icon {
          width: 30px;
          height: 30px;
          border-radius: var(--cm-radius);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .cm-kpi-icon.orders { background: rgba(240,185,11,0.12); color: var(--cm-accent); }
        .cm-kpi-icon.revenue { background: var(--cm-green-bg); color: var(--cm-green); }
        .cm-kpi-icon.top { background: rgba(240,185,11,0.08); color: var(--cm-accent); }
        .cm-kpi-icon.coverage { background: rgba(183,189,198,0.08); color: var(--cm-text-secondary); }
        .cm-kpi-info { display: flex; flex-direction: column; gap: 1px; }
        .cm-kpi-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--cm-text-muted);
        }
        .cm-kpi-value {
          font-size: 16px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--cm-text-primary);
          line-height: 1.2;
        }
        .cm-kpi-sub {
          font-size: 10px;
          color: var(--cm-text-muted);
          font-variant-numeric: tabular-nums;
        }

        /* ── Layout ── */
        .cm-layout {
          display: flex;
          height: calc(100vh - 103px);
          overflow: hidden;
        }

        /* ── Sidebar ── */
        .cm-sidebar {
          width: 280px;
          min-width: 280px;
          background: var(--cm-card-bg);
          border-right: 1px solid var(--cm-border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: width 0.2s, min-width 0.2s;
        }
        .cm-sidebar.collapsed { width: 0; min-width: 0; border-right: none; }
        .cm-sidebar-header {
          padding: 10px 12px;
          border-bottom: 1px solid var(--cm-border);
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--cm-card-bg2);
        }
        .cm-sidebar-col-headers {
          display: flex;
          justify-content: space-between;
          padding: 5px 12px;
          border-bottom: 1px solid var(--cm-border);
          background: var(--cm-card-bg2);
        }
        .cm-sidebar-col-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--cm-text-muted);
        }
        .cm-search-box { position: relative; flex: 1; }
        .cm-search-input {
          width: 100%;
          background: var(--cm-input-bg);
          border: 1px solid var(--cm-border);
          border-radius: var(--cm-radius);
          padding: 6px 10px 6px 30px;
          font-size: 12px;
          color: var(--cm-text-primary);
          outline: none;
          font-family: inherit;
          box-sizing: border-box;
        }
        .cm-search-input:focus { border-color: var(--cm-accent); }
        .cm-search-input::placeholder { color: var(--cm-text-muted); }
        .cm-search-icon {
          position: absolute;
          left: 9px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--cm-text-muted);
          width: 13px;
          height: 13px;
          pointer-events: none;
        }
        .cm-province-list { flex: 1; overflow-y: auto; }
        .cm-province-list::-webkit-scrollbar { width: 3px; }
        .cm-province-list::-webkit-scrollbar-thumb { background: var(--cm-border); border-radius: 2px; }
        .cm-province-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          cursor: pointer;
          transition: background 0.08s;
          border-bottom: 1px solid var(--cm-border-subtle);
          gap: 8px;
        }
        .cm-province-item:hover { background: var(--cm-hover); }
        .cm-province-item.active { background: var(--cm-accent-light); border-left: 2px solid var(--cm-accent); padding-left: 10px; }
        .cm-province-item-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .cm-province-color-dot {
          width: 8px;
          height: 8px;
          border-radius: 1px;
          flex-shrink: 0;
        }
        .cm-province-item-name .km { font-size: 12px; font-weight: 600; color: var(--cm-text-primary); }
        .cm-province-item-name .en { font-size: 10px; color: var(--cm-text-muted); margin-top: 1px; }
        .cm-province-item-right { text-align: right; flex-shrink: 0; }
        .cm-province-item-value {
          font-size: 12px;
          font-weight: 700;
          color: var(--cm-accent);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .cm-province-item-bar {
          width: 40px;
          height: 3px;
          background: var(--cm-border);
          border-radius: 1px;
          margin-top: 3px;
          overflow: hidden;
        }
        .cm-province-item-bar-fill { height: 100%; border-radius: 1px; }
        .cm-no-results { padding: 20px 12px; text-align: center; color: var(--cm-text-muted); font-size: 12px; }

        /* ── Map Area ── */
        .cm-map-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          overflow-x: hidden;
          background: var(--cm-bg);
        }
        .cm-map-area::-webkit-scrollbar { width: 3px; }
        .cm-map-area::-webkit-scrollbar-thumb { background: var(--cm-border); border-radius: 2px; }
        .cm-map-container {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 10px;
          min-height: 600px;
          height: 65vh;
          background: radial-gradient(ellipse at center, #13161C 0%, #0B0E11 70%);
        }
        .cm-map-svg {
          width: 100%;
          height: 100%;
          max-height: 100%;
          filter: drop-shadow(0 4px 20px rgba(0,0,0,0.6));
        }
        .cm-province-path {
          stroke: rgba(255, 255, 255, 0.5);
          stroke-width: 1.2;
          cursor: pointer;
          transition: fill 0.2s, stroke 0.2s, stroke-width 0.2s, filter 0.2s, opacity 0.2s;
          vector-effect: non-scaling-stroke;
        }
        .cm-province-path:hover { 
          stroke-width: 2.5; 
          stroke: #fff; 
          filter: brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.4));
          z-index: 50;
        }
        .cm-province-path.selected { 
          stroke-width: 3; 
          stroke: var(--cm-accent); 
          filter: brightness(1.2) drop-shadow(0 0 12px rgba(240,185,11,0.6));
          z-index: 100;
        }
        .cm-province-path.dimmed { opacity: 0.25; }
        /* Province SVG labels */
        .cm-province-label {
          font-family: 'Inter', sans-serif;
          font-size: 7px;
          font-weight: 700;
          fill: rgba(234,236,239,0.7);
          pointer-events: none;
          text-anchor: middle;
          dominant-baseline: middle;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .cm-province-label.active-label { fill: #F0B90B; font-size: 8px; }

        /* ── Tooltip ── */
        .cm-tooltip {
          position: absolute;
          background: #1E2329;
          border: 1px solid #2B3139;
          border-radius: 4px;
          padding: 12px 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.8), 0 0 0 1px rgba(240,185,11,0.1);
          pointer-events: none;
          z-index: 100;
          min-width: 200px;
          transform: translate(-50%, -112%);
        }
        .cm-tooltip::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: 8px;
          height: 8px;
          background: #1E2329;
          border-right: 1px solid #2B3139;
          border-bottom: 1px solid #2B3139;
          transform: translateX(-50%) rotate(45deg);
        }
        .cm-tooltip-title { font-size: 13px; font-weight: 700; color: #EAECEF; margin-bottom: 2px; }
        .cm-tooltip-subtitle { font-size: 11px; color: #707A8A; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #2B3139; }
        .cm-tooltip-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; gap: 16px; }
        .cm-tooltip-label { color: #707A8A; }
        .cm-tooltip-value { font-weight: 600; color: #EAECEF; font-variant-numeric: tabular-nums; }
        .cm-tooltip-accent { color: #F0B90B; }
        .cm-tooltip-green { color: #0ECB81; }

        /* ── Legend ── */
        .cm-legend {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          background: var(--cm-card-bg);
          border-top: 1px solid var(--cm-border);
          flex-shrink: 0;
        }
        .cm-legend-label { font-size: 10px; color: var(--cm-text-muted); font-weight: 700; white-space: nowrap; letter-spacing: 0.05em; text-transform: uppercase; }
        .cm-legend-bar { flex: 1; height: 6px; border-radius: 1px; display: flex; overflow: hidden; }
        .cm-legend-segment { flex: 1; height: 100%; }

        /* ── Ranking Table ── */
        .cm-table-section {
          border-top: 1px solid var(--cm-border);
          background: var(--cm-card-bg);
          flex-shrink: 0;
        }
        .cm-table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 16px;
          border-bottom: 1px solid var(--cm-border);
          background: var(--cm-card-bg2);
        }
        .cm-table-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--cm-text-muted);
        }
        .cm-table-toggle {
          font-size: 11px;
          color: var(--cm-accent);
          cursor: pointer;
          background: none;
          border: none;
          font-family: inherit;
          font-weight: 600;
          padding: 0;
        }
        .cm-table-toggle:hover { text-decoration: underline; }
        .cm-table-scroll { max-height: 240px; overflow-y: auto; overflow-x: auto; }
        .cm-table-scroll::-webkit-scrollbar { width: 3px; height: 3px; }
        .cm-table-scroll::-webkit-scrollbar-thumb { background: var(--cm-border); border-radius: 2px; }
        .cm-ranking-table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
        .cm-th {
          padding: 7px 12px;
          text-align: left;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--cm-text-muted);
          background: var(--cm-card-bg2);
          border-bottom: 1px solid var(--cm-border);
          cursor: pointer;
          user-select: none;
          position: sticky;
          top: 0;
          z-index: 2;
          white-space: nowrap;
        }
        .cm-th:hover { color: var(--cm-text-primary); }
        .cm-th.active { color: var(--cm-accent); }
        .cm-td {
          padding: 7px 12px;
          border-bottom: 1px solid var(--cm-border-subtle);
          color: var(--cm-text-primary);
          font-variant-numeric: tabular-nums;
        }
        .cm-td.muted { color: var(--cm-text-secondary); }
        .cm-tr { cursor: pointer; }
        .cm-tr:hover .cm-td { background: var(--cm-hover); }
        .cm-tr.active-row .cm-td { background: var(--cm-accent-light); }
        .cm-rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 2px;
          font-size: 10px;
          font-weight: 800;
          background: var(--cm-hover);
          color: var(--cm-text-muted);
        }
        .cm-rank-badge.top1 { background: var(--cm-accent); color: #1E2329; }
        .cm-rank-badge.top2 { background: #2B3139; color: #B7BDC6; border: 1px solid #474D57; }
        .cm-rank-badge.top3 { background: var(--cm-green-bg); color: var(--cm-green); border: 1px solid var(--cm-green-border); }
        .cm-pct-badge {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 2px;
          font-size: 10px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .cm-pct-badge.green { background: var(--cm-green-bg); color: var(--cm-green); }
        .cm-pct-badge.red { background: var(--cm-red-bg); color: var(--cm-red); }
        .cm-pct-badge.neutral { background: var(--cm-accent-light); color: var(--cm-accent); }

        /* ── Details Panel ── */
        .cm-details-panel {
          width: 300px;
          min-width: 300px;
          background: var(--cm-card-bg);
          border-left: 1px solid var(--cm-border);
          overflow-y: auto;
          transition: width 0.2s, min-width 0.2s;
        }
        .cm-details-panel::-webkit-scrollbar { width: 3px; }
        .cm-details-panel::-webkit-scrollbar-thumb { background: var(--cm-border); border-radius: 2px; }
        .cm-details-panel.collapsed { width: 0; min-width: 0; overflow: hidden; }
        .cm-details-header {
          padding: 14px 16px;
          border-bottom: 1px solid var(--cm-border);
          position: relative;
          background: var(--cm-card-bg2);
        }
        .cm-details-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: var(--cm-hover);
          border: none;
          cursor: pointer;
          color: var(--cm-text-muted);
          font-size: 14px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--cm-radius);
          font-family: inherit;
          transition: all 0.1s;
        }
        .cm-details-close:hover { background: var(--cm-border); color: var(--cm-text-primary); }
        .cm-details-province-name { font-size: 18px; font-weight: 800; color: var(--cm-text-primary); margin-bottom: 2px; padding-right: 28px; font-family: 'Noto Sans Khmer', sans-serif; }
        .cm-details-province-en { font-size: 12px; color: var(--cm-text-muted); font-weight: 500; }
        .cm-details-body { 
          padding: 14px; 
          padding-bottom: calc(20px + env(safe-area-inset-bottom)); 
          flex: 1;
        }
        .cm-details-section { margin-bottom: 16px; }
        .cm-details-section-title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--cm-text-muted);
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--cm-border);
        }
        .cm-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .cm-stat-card {
          background: var(--cm-input-bg);
          border-radius: var(--cm-radius);
          padding: 9px 10px;
          border: 1px solid var(--cm-border);
        }
        .cm-stat-card.full { grid-column: 1 / -1; }
        .cm-stat-label { font-size: 10px; color: var(--cm-text-muted); margin-bottom: 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .cm-stat-value { font-size: 14px; font-weight: 700; color: var(--cm-text-primary); font-variant-numeric: tabular-nums; }
        .cm-stat-value.green { color: var(--cm-green); }
        .cm-stat-value.accent { color: var(--cm-accent); }
        .cm-sector-badge {
          display: inline-block;
          background: var(--cm-accent-light);
          color: var(--cm-accent);
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 2px;
          border: 1px solid var(--cm-accent-border);
        }
        /* Progress bars */
        .cm-progress-row { margin-bottom: 10px; }
        .cm-progress-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--cm-text-secondary);
          margin-bottom: 4px;
          font-weight: 500;
        }
        .cm-progress-bar { height: 4px; background: var(--cm-border); border-radius: 2px; overflow: hidden; }
        .cm-progress-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
        .cm-progress-fill.green { background: var(--cm-green); }
        .cm-progress-fill.yellow { background: var(--cm-accent); }
        /* Recent orders */
        .cm-recent-order-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid var(--cm-border);
          font-size: 11px;
          gap: 6px;
        }
        .cm-recent-order-item:last-child { border-bottom: none; }
        .cm-order-id { color: var(--cm-accent); font-weight: 600; font-variant-numeric: tabular-nums; }
        .cm-order-date { color: var(--cm-text-muted); }
        .cm-order-amount { font-weight: 700; color: var(--cm-text-primary); font-variant-numeric: tabular-nums; }
        .cm-order-badge {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 2px;
          font-size: 10px;
          font-weight: 600;
        }
        .cm-order-badge.paid { background: var(--cm-green-bg); color: var(--cm-green); }
        .cm-order-badge.unpaid { background: var(--cm-red-bg); color: var(--cm-red); }
        .cm-top-user-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: var(--cm-accent-light);
          border: 1px solid rgba(240,185,11,0.2);
          color: var(--cm-accent);
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 2px;
        }
        .cm-no-orders-state {
          padding: 20px 0;
          text-align: center;
          color: var(--cm-text-muted);
          font-size: 12px;
        }

        /* Top province glow animation */
        @keyframes cm-pulse-ring {
          0%   { opacity: 0.8; r: 6; }
          50%  { opacity: 0.3; r: 9; }
          100% { opacity: 0.8; r: 6; }
        }
        .cm-top-province-dot {
          animation: cm-pulse-ring 2s ease-in-out infinite;
        }

        /* ── Accessibility ── */
        .cm-province-item:focus-visible,
        .cm-icon-btn:focus-visible,
        .cm-metric-tab:focus-visible,
        .cm-search-input:focus-visible,
        .cm-province-path:focus-visible {
          outline: 2px solid var(--cm-accent);
          outline-offset: 2px;
        }

        /* ── Responsive ── */
        @media (max-width: 1200px) {
          .cm-sidebar { width: 240px; min-width: 240px; }
          .cm-details-panel { width: 270px; min-width: 270px; }
          .cm-metric-tab { padding: 0 10px; font-size: 11px; }
        }
        @media (max-width: 900px) {
          .cm-layout { flex-direction: column; height: auto; overflow: visible; position: relative; }
          .cm-map-area { overflow: visible; height: calc(100svh - 150px); }
          .cm-sidebar { 
            position: absolute; 
            top: 0; left: 0; 
            width: 100%; height: 100%; 
            z-index: 300; 
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            transform: translateX(-100%);
            border-right: none;
            background: rgba(11, 14, 17, 0.98);
            backdrop-filter: blur(10px);
          }
          .cm-sidebar:not(.collapsed) { transform: translateX(0); }
          
          /* Bottom Sheet with Safe Area Support for Pixel 9 Pro */
          .cm-details-panel { 
            position: fixed;
            bottom: 0; left: 0;
            width: 100%; min-width: 100%;
            height: clamp(50svh, 70svh, 85svh);
            z-index: 400;
            border-left: none;
            border-top: 1px solid var(--cm-accent);
            border-radius: 12px 12px 0 0;
            transform: translateY(100%);
            transition: transform 0.4s cubic-bezier(0.075, 0.82, 0.165, 1);
            box-shadow: 0 -10px 40px rgba(0,0,0,0.9);
            background: #0B0E11;
            display: flex;
            flex-direction: column;
          }
          .cm-details-panel:not(.collapsed) { transform: translateY(0); }
          .cm-details-handle {
             width: 36px; height: 4px;
             background: rgba(255,255,255,0.15);
             border-radius: 2px;
             margin: 10px auto 4px auto;
             flex-shrink: 0;
          }

          .cm-header { 
            padding: calc(4px + env(safe-area-inset-top)) 12px 8px 12px; 
            gap: 8px; 
            background: #0B0E11;
          }
          .cm-header-title h1 { font-size: 11px; font-weight: 800; letter-spacing: 0.02em; }
          .cm-metric-tabs { display: none; }
          .cm-header-actions { gap: 4px; }
          .cm-team-select { width: 75px; font-size: 10px; height: 28px; }
          
          .cm-map-container { height: 100%; min-height: calc(100svh - 220px); padding: 0; background: #050505; }
          
          /* High-Contrast Ticker for OLED */
          .cm-kpi-bar {
            padding: 6px 0;
            background: #000000;
            border-bottom: 1px solid #1a1a1a;
          }
          .cm-kpi-cell {
            padding: 8px 16px;
            border-right: 1px solid #1a1a1a;
            position: relative;
            overflow: hidden;
          }
          .cm-kpi-value { font-size: 15px; font-weight: 800; }
          
          .cm-table-section { border-top: 1px solid #1a1a1a; background: #080808; }
          .cm-th.hide-mobile, .cm-td.hide-mobile { display: none; }
          
          /* Refined Shimmer for OLED */
          @keyframes cm-shimmer {
            0% { transform: translateX(-150%); opacity: 0; }
            50% { opacity: 0.4; }
            100% { transform: translateX(150%); opacity: 0; }
          }
          .cm-kpi-cell::after {
            content: "";
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(240,185,11,0.08), transparent);
            animation: cm-shimmer 4s infinite ease-out;
            pointer-events: none;
          }

          /* Mobile Filter Bar for Time Period */
          .cm-mobile-filter-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 12px;
            background: #0B0E11;
            border-bottom: 1px solid #1A1A1A;
            overflow-x: auto;
            scrollbar-width: none; /* Hide scrollbar Firefox */
            -ms-overflow-style: none; /* Hide scrollbar IE/Edge */
            max-width: 100%;
          }
          .cm-mobile-filter-bar::-webkit-scrollbar { display: none; } /* Hide scrollbar Chrome/Safari */
          .cm-mobile-filter-label {
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 800;
            color: var(--cm-text-muted);
            white-space: nowrap;
          }
        }
        @media print {
          .cm-sidebar, .cm-details-panel, .cm-header, .cm-kpi-bar, .cm-table-section { display: none; }
          .cm-map-area { width: 100%; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className="cm-header" role="banner">
        <div className="cm-header-left">
          <div className="cm-header-title">
            {onBack && (
              <button
                className="cm-icon-btn"
                onClick={onBack}
                aria-label="Go back"
                style={{ padding: '4px 8px', borderColor: 'transparent', background: 'transparent' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
            )}
            <div className="cm-logo-icon" aria-hidden="true">KH</div>
            <h1>{t('title')}</h1>
          </div>

          {/* Metric Tabs — inline in header like Binance trading pair tabs */}
          <nav className="cm-metric-tabs" role="tablist" aria-label={t('metric')}>
            {Object.entries(METRICS).map(([key, config]) => (
              <button
                key={key}
                role="tab"
                aria-selected={selectedMetric === key}
                className={`cm-metric-tab ${selectedMetric === key ? 'active' : ''}`}
                onClick={() => setSelectedMetric(key as MetricKey)}
              >
                {language === 'km' ? config.label_km : config.label_en}
              </button>
            ))}
          </nav>
        </div>

        <div className="cm-header-actions">
          {/* Mobile Metric Selector */}
          <div className="md:hidden">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
              className="cm-team-select"
              style={{ width: 'auto', marginRight: '4px' }}
            >
              {Object.entries(METRICS).map(([key, config]) => (
                <option key={key} value={key}>
                  {language === 'km' ? config.label_km : config.label_en}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop Filters (Hidden on Mobile) */}
          {dateFilter && setDateFilter && (
            <div className="cm-header-filter-group hidden md:flex">
               {teams && selectedTeam && setSelectedTeam && (
                  <select 
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="cm-team-select"
                  >
                    {teams.map(t => (
                      <option key={t} value={t}>{t === 'All' ? (language === 'km' ? 'ក្រុម' : 'Team') : t}</option>
                    ))}
                  </select>
               )}
               <DateRangeFilter
                  variant="binance"
                  dateRange={dateFilter.preset}
                  onRangeChange={(r) => setDateFilter({ ...dateFilter, preset: r })}
                  customStart={dateFilter.start}
                  onCustomStartChange={(v) => setDateFilter({ ...dateFilter, start: v })}
                  customEnd={dateFilter.end}
                  onCustomEndChange={(v) => setDateFilter({ ...dateFilter, end: v })}
                />
            </div>
          )}

          <button
            className="cm-icon-btn"
            onClick={() => setIsSidebarOpen(v => !v)}
            aria-label="Toggle sidebar"
            style={{ color: isSidebarOpen ? 'var(--cm-accent)' : 'inherit', borderColor: isSidebarOpen ? 'var(--cm-accent)' : 'inherit' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          <button
            className="cm-icon-btn"
            onClick={() => setLanguage(l => l === 'km' ? 'en' : 'km')}
            aria-label="Switch language"
          >
            {language === 'km' ? 'EN' : 'ខ្មែរ'}
          </button>
        </div>
      </header>
      
      {/* ── MOBILE FILTER BAR (Dedicated to Time Period) ── */}
      <div className="cm-mobile-filter-bar md:hidden" role="navigation" aria-label="Filters">
        <div className="cm-mobile-filter-label">{language === 'km' ? 'រយៈពេល' : 'Period'}</div>
        {dateFilter && setDateFilter && (
           <DateRangeFilter
             variant="binance"
             dateRange={dateFilter.preset}
             onRangeChange={(r) => setDateFilter({ ...dateFilter, preset: r })}
             customStart={dateFilter.start}
             onCustomStartChange={(v) => setDateFilter({ ...dateFilter, start: v })}
             customEnd={dateFilter.end}
             onCustomEndChange={(v) => setDateFilter({ ...dateFilter, end: v })}
           />
        )}
        <div style={{ paddingLeft: 4 }}>
           {teams && selectedTeam && setSelectedTeam && (
              <select 
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="cm-team-select"
                style={{ height: 28, fontSize: 10 }}
              >
                {teams.map(t => (
                  <option key={t} value={t}>{t === 'All' ? (language === 'km' ? 'ក្រុម' : 'Team') : t}</option>
                ))}
              </select>
           )}
        </div>
      </div>

      {/* ── KPI TICKER BAR ── */}
      <div className="cm-kpi-bar" role="region" aria-label="Key metrics">
        {/* Total Orders */}
        <div className="cm-kpi-cell">
          <div className="cm-kpi-icon orders" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div className="cm-kpi-info">
            <div className="cm-kpi-label">{t('kpi_total_orders')}</div>
            <div className="cm-kpi-value" style={{ color: 'var(--cm-accent)' }}>
              {kpiStats.total_orders.toLocaleString()}
            </div>
            <div className="cm-kpi-sub">{language === 'km' ? 'ការកម្មង់សរុប' : 'total placed'}</div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="cm-kpi-cell">
          <div className="cm-kpi-icon revenue" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          </div>
          <div className="cm-kpi-info">
            <div className="cm-kpi-label">{t('kpi_total_revenue')}</div>
            <div className="cm-kpi-value" style={{ color: 'var(--cm-green)' }}>
              ${formatNumber(kpiStats.total_revenue)}
            </div>
            <div className="cm-kpi-sub">{language === 'km' ? 'ចំណូលរួម' : 'gross revenue'}</div>
          </div>
        </div>

        {/* Top Province */}
        <div className="cm-kpi-cell">
          <div className="cm-kpi-icon top" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="cm-kpi-info">
            <div className="cm-kpi-label">{t('kpi_top_province')}</div>
            <div className="cm-kpi-value" style={{ color: 'var(--cm-accent)', fontSize: 14, fontWeight: 800 }}>
              {kpiStats.top_province_name}
            </div>
            {kpiStats.top_province_revenue > 0 && (
              <div className="cm-kpi-sub" style={{ color: 'var(--cm-green)' }}>${formatNumber(kpiStats.top_province_revenue)}</div>
            )}
          </div>
        </div>

        {/* Coverage */}
        <div className="cm-kpi-cell">
          <div className="cm-kpi-icon coverage" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
            </svg>
          </div>
          <div className="cm-kpi-info">
            <div className="cm-kpi-label">{t('kpi_coverage')}</div>
            <div className="cm-kpi-value">
              <span style={{ color: 'var(--cm-text-primary)' }}>{kpiStats.covered_provinces}</span>
              <span style={{ fontSize: 12, color: 'var(--cm-text-muted)', fontWeight: 500 }}>/25</span>
            </div>
            <div className="cm-kpi-sub">{language === 'km' ? 'ខេត្ត' : 'provinces active'}</div>
          </div>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="cm-layout">
        {/* LEFT SIDEBAR */}
        <aside className={`cm-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`} role="complementary" aria-label={t('provinces')}>
          <div className="cm-sidebar-header">
            <div className="cm-search-box">
              <svg className="cm-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                className="cm-search-input"
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('search')}
              />
            </div>
          </div>
          {/* Column headers */}
          <div className="cm-sidebar-col-headers">
            <span className="cm-sidebar-col-label">{language === 'km' ? 'ខេត្ត/រាជធានី' : 'Province'}</span>
            <span className="cm-sidebar-col-label">{language === 'km' ? metricConfig.label_km : metricConfig.label_en}</span>
          </div>
          <div className="cm-province-list" role="listbox" aria-label={t('provinces')}>
            {filteredProvinces.length === 0 ? (
              <div className="cm-no-results">{t('no_results')}</div>
            ) : (
              filteredProvinces.map((p) => {
                const val = getMetricValue(p);
                const color = getMetricColor(val, metricMin, metricMax, metricConfig.colorRange, selectedMetric === 'unemployment_rate');
                const barPct = metricMax > metricMin ? Math.max(4, ((val - metricMin) / (metricMax - metricMin)) * 100) : 0;
                return (
                  <div
                    key={p.province_id}
                    className={`cm-province-item ${selectedProvince?.province_id === p.province_id ? 'active' : ''}`}
                    onClick={() => handleProvinceClick(p)}
                    onKeyDown={(e) => e.key === 'Enter' && handleProvinceClick(p)}
                    role="option"
                    aria-selected={selectedProvince?.province_id === p.province_id}
                    tabIndex={0}
                  >
                    <div className="cm-province-item-left">
                      <div className="cm-province-color-dot" style={{ background: color }} />
                      <div className="cm-province-item-name">
                        <div className="km">{p.name_km}</div>
                        <div className="en">{p.name_en}</div>
                      </div>
                    </div>
                    <div className="cm-province-item-right">
                      <div className="cm-province-item-value">{metricConfig.format(val)}</div>
                      <div className="cm-province-item-bar">
                        <div className="cm-province-item-bar-fill" style={{ width: `${barPct}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* MAP + TABLE */}
        <div className="cm-map-area">
          <div className="cm-map-container" ref={mapContainerRef} style={{ padding: isRealMapMode ? 0 : '10px' }}>
            {/* 3D REAL MAP (MapLibre) will be injected here into mapContainerRef */}

            {/* SVG MAP - Conditionally Rendered */}
            {!isRealMapMode && (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="cm-map-svg"
                role="img"
                aria-label={language === 'km' ? 'ផែនទីកម្ពុជា' : 'Cambodia Map'}
                onMouseMove={handleMouseMove}
              >
                {/* SVG Contents... */}
              </svg>
            )}

            {/* TOOLTIP - Shared */}
            {tooltipData && (
              <div
                className="cm-tooltip"
                style={{ left: tooltipData.x, top: tooltipData.y }}
                role="tooltip"
              >
                <div className="cm-tooltip-title">
                  {language === 'km' ? tooltipData.province.name_km : tooltipData.province.name_en}
                </div>
                <div className="cm-tooltip-subtitle">
                  {language === 'km' ? tooltipData.province.name_en : tooltipData.province.name_km}
                </div>
                <div className="cm-tooltip-row">
                  <span className="cm-tooltip-label">{language === 'km' ? 'ប្រជាជន' : 'Population'}</span>
                  <span className="cm-tooltip-value">{formatNumber(tooltipData.province.population)}</span>
                </div>
                <div className="cm-tooltip-row">
                  <span className="cm-tooltip-label">GDP</span>
                  <span className="cm-tooltip-value">${formatNumber(tooltipData.province.gdp_usd)}</span>
                </div>
                {(() => {
                  const stat = provinceOrderStats[tooltipData.province.province_id];
                  if (!stat || stat.orders_count === 0) return null;
                  return (
                    <>
                      <div className="cm-tooltip-row" style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--cm-border)' }}>
                        <span className="cm-tooltip-label">{language === 'km' ? 'ការកម្មង់' : 'Orders'}</span>
                        <span className="cm-tooltip-value cm-tooltip-accent">{stat.orders_count.toLocaleString()}</span>
                      </div>
                      <div className="cm-tooltip-row">
                        <span className="cm-tooltip-label">{language === 'km' ? 'ចំណូល' : 'Revenue'}</span>
                        <span className="cm-tooltip-value cm-tooltip-green">${formatNumber(stat.revenue)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* COLOR LEGEND */}
          <div className="cm-legend" role="img" aria-label={t('legend')}>
            <span className="cm-legend-label">{t('low')}</span>
            <div className="cm-legend-bar">
              {metricConfig.colorRange.map((color, i) => (
                <div key={i} className="cm-legend-segment" style={{ backgroundColor: color }} />
              ))}
            </div>
            <span className="cm-legend-label">{t('high')}</span>
            <span className="cm-legend-label" style={{ marginLeft: 8, opacity: 0.6 }}>
              ({language === 'km' ? metricConfig.label_km : metricConfig.label_en})
            </span>
          </div>

          {/* PROVINCE RANKING TABLE */}
          <div className="cm-table-section">
            <div className="cm-table-header">
              <span className="cm-table-title">{t('table_title')}</span>
              <button
                className="cm-table-toggle"
                onClick={() => setTableShowAll(v => !v)}
              >
                {tableShowAll ? t('show_active') : t('show_all')}
              </button>
            </div>
            <div className="cm-table-scroll">
              <table className="cm-ranking-table">
                <thead>
                  <tr>
                    <th className="cm-th" style={{ width: 36 }}>#</th>
                    <th
                      className={`cm-th ${tableSortKey === 'name' ? 'active' : ''}`}
                      onClick={() => handleTableSort('name')}
                    >
                      {language === 'km' ? 'ខេត្ត' : 'Province'}{tableSortKey === 'name' ? (tableSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      className={`cm-th ${tableSortKey === 'orders_count' ? 'active' : ''}`}
                      onClick={() => handleTableSort('orders_count')}
                    >
                      {language === 'km' ? 'ការកម្មង់' : 'Orders'}{tableSortKey === 'orders_count' ? (tableSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      className={`cm-th ${tableSortKey === 'revenue' ? 'active' : ''}`}
                      onClick={() => handleTableSort('revenue')}
                    >
                      {language === 'km' ? 'ចំណូល' : 'Revenue'}{tableSortKey === 'revenue' ? (tableSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      className={`cm-th hide-mobile ${tableSortKey === 'paid_pct' ? 'active' : ''}`}
                      onClick={() => handleTableSort('paid_pct')}
                    >
                      {language === 'km' ? 'បានបង់' : 'Paid %'}{tableSortKey === 'paid_pct' ? (tableSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th
                      className={`cm-th hide-mobile ${tableSortKey === 'delivered_pct' ? 'active' : ''}`}
                      onClick={() => handleTableSort('delivered_pct')}
                    >
                      {language === 'km' ? 'ដឹកជញ្ជូន' : 'Delivered %'}{tableSortKey === 'delivered_pct' ? (tableSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTableData.length === 0 ? (
                    <tr>
                      <td className="cm-td" colSpan={6} style={{ textAlign: 'center', color: 'var(--cm-text-muted)', padding: '20px 12px' }}>
                        {language === 'km' ? 'មិនមានទិន្នន័យ' : 'No data available'}
                      </td>
                    </tr>
                  ) : (
                    sortedTableData.map((row, idx) => {
                      const paidPct = row.orders_count ? row.paid_count / row.orders_count : 0;
                      const delivPct = row.orders_count ? row.delivered_count / row.orders_count : 0;
                      const isActiveRow = selectedProvince?.province_id === row.province_id;
                      const rankClass = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
                      return (
                        <tr
                          key={row.province_id}
                          className={`cm-tr ${isActiveRow ? 'active-row' : ''}`}
                          onClick={() => {
                            const p = provinces.find(p => p.province_id === row.province_id);
                            if (p) handleProvinceClick(p);
                          }}
                        >
                          <td className="cm-td" style={{ textAlign: 'center' }}>
                            <span className={`cm-rank-badge ${rankClass}`}>{idx + 1}</span>
                          </td>
                          <td className="cm-td">
                            <div style={{ fontWeight: 600, fontSize: 12 }}>
                              {language === 'km' ? row.name_km : row.name_en}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--cm-text-muted)' }}>
                              {language === 'km' ? row.name_en : row.name_km}
                            </div>
                          </td>
                          <td className="cm-td" style={{ fontWeight: 600 }}>
                            {row.orders_count.toLocaleString()}
                          </td>
                          <td className="cm-td" style={{ color: 'var(--cm-green)', fontWeight: 700 }}>
                            ${formatNumber(row.revenue)}
                          </td>
                          <td className="cm-td hide-mobile">
                            <span className={getPctBadgeClass(paidPct)}>
                              {row.orders_count ? Math.round(paidPct * 100) + '%' : '—'}
                            </span>
                          </td>
                          <td className="cm-td hide-mobile">
                            <span className={getPctBadgeClass(delivPct)}>
                              {row.orders_count ? Math.round(delivPct * 100) + '%' : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT DETAILS PANEL / MOBILE BOTTOM SHEET */}
        <aside className={`cm-details-panel ${!selectedProvince ? 'collapsed' : ''}`} role="complementary" aria-label={t('detail')}>
          <div className="cm-details-handle md:hidden" />
          {selectedProvince && (() => {
            const orderStat = provinceOrderStats[selectedProvince.province_id];
            const paidPct = orderStat?.orders_count ? orderStat.paid_count / orderStat.orders_count : 0;
            const delivPct = orderStat?.orders_count ? orderStat.delivered_count / orderStat.orders_count : 0;
            const hasOrders = orderStat && orderStat.orders_count > 0;

            return (
              <>
                <div className="cm-details-header">
                  <button
                    className="cm-details-close"
                    onClick={() => setSelectedProvince(null)}
                    aria-label="Close details"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                  <div className="cm-details-province-name">
                    {language === 'km' ? selectedProvince.name_km : selectedProvince.name_en}
                  </div>
                  <div className="cm-details-province-en">
                    {language === 'km' ? selectedProvince.name_en : selectedProvince.name_km}
                  </div>
                </div>

                <div className="cm-details-body custom-scrollbar">
                  <div className="cm-details-section">
                    <div className="cm-details-section-title">{t('order_stats')}</div>
                    {hasOrders ? (
                      <>
                        <div className="cm-stat-grid" style={{ marginBottom: 12 }}>
                          <div className="cm-stat-card">
                            <div className="cm-stat-label">{t('revenue')}</div>
                            <div className="cm-stat-value green">${formatNumber(orderStat.revenue || 0)}</div>
                          </div>
                          <div className="cm-stat-card">
                            <div className="cm-stat-label">{t('orders')}</div>
                            <div className="cm-stat-value accent">{(orderStat.orders_count || 0).toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="cm-progress-row">
                          <div className="cm-progress-label-row">
                            <span>{t('paid')}</span>
                            <span style={{ fontWeight: 600, color: 'var(--cm-green)' }}>
                              {orderStat.paid_count}/{orderStat.orders_count} ({Math.round(paidPct * 100)}%)
                            </span>
                          </div>
                          <div className="cm-progress-bar">
                            <div className="cm-progress-fill yellow" style={{ width: `${paidPct * 100}%` }} />
                          </div>
                        </div>
                        <div className="cm-progress-row">
                          <div className="cm-progress-label-row">
                            <span>{t('delivered')}</span>
                            <span style={{ fontWeight: 600, color: 'var(--cm-accent)' }}>
                              {orderStat.delivered_count}/{orderStat.orders_count} ({Math.round(delivPct * 100)}%)
                            </span>
                          </div>
                          <div className="cm-progress-bar">
                            <div className="cm-progress-fill green" style={{ width: `${delivPct * 100}%` }} />
                          </div>
                        </div>

                        {orderStat.top_user && (
                          <div style={{ marginTop: 10 }}>
                            <div className="cm-stat-label" style={{ marginBottom: 5 }}>{t('top_user')}</div>
                            <span className="cm-top-user-badge">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                              </svg>
                              {orderStat.top_user}
                            </span>
                          </div>
                        )}

                        {orderStat.recent_orders.length > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <div className="cm-stat-label" style={{ marginBottom: 8 }}>{t('recent_orders')}</div>
                            {orderStat.recent_orders.map((ro, i) => (
                              <div key={i} className="cm-recent-order-item">
                                <span className="cm-order-id">#{ro.order_id.slice(-6)}</span>
                                <span className="cm-order-date">{formatDate(ro.timestamp)}</span>
                                <span className="cm-order-amount">${ro.grand_total.toLocaleString()}</span>
                                <span className={`cm-order-badge ${ro.payment_status.toLowerCase() === 'paid' ? 'paid' : 'unpaid'}`}>
                                  {ro.payment_status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="cm-no-orders-state">
                        <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.4 }}>📦</div>
                        <div>{t('no_orders')}</div>
                      </div>
                    )}
                  </div>

                  <div className="cm-details-section">
                    <div className="cm-details-section-title">{t('detail')}</div>
                    <div className="cm-stat-grid">
                      <div className="cm-stat-card">
                        <div className="cm-stat-label">{t('capital')}</div>
                        <div className="cm-stat-value" style={{ fontSize: 13 }}>
                          {language === 'km' ? selectedProvince.capital : selectedProvince.capital_en}
                        </div>
                      </div>
                      <div className="cm-stat-card">
                        <div className="cm-stat-label">{t('area')}</div>
                        <div className="cm-stat-value" style={{ fontSize: 13 }}>{selectedProvince.area_km2.toLocaleString()} km²</div>
                      </div>
                      <div className="cm-stat-card">
                        <div className="cm-stat-label">{t('population')}</div>
                        <div className="cm-stat-value">{formatNumber(selectedProvince.population)}</div>
                      </div>
                      <div className="cm-stat-card">
                        <div className="cm-stat-label">GDP</div>
                        <div className="cm-stat-value">${formatNumber(selectedProvince.gdp_usd)}</div>
                      </div>
                      <div className="cm-stat-card">
                        <div className="cm-stat-label">{t('unemployment')}</div>
                        <div className="cm-stat-value">{selectedProvince.unemployment_rate}%</div>
                      </div>
                      <div className="cm-stat-card full">
                        <div className="cm-stat-label">{t('sector')}</div>
                        <div style={{ marginTop: 5 }}>
                          <span className="cm-sector-badge">{selectedProvince.main_economic_sector}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </aside>
      </div>
    </div>
  );
};

export default CambodiaMap;
