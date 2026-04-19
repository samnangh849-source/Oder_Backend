
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ParsedOrder, AppData } from '../../types';
import Spinner from '../common/Spinner';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

// Local Khmer TTF — used as fallback if CDN font unavailable
import domkhFontUrl from '../../Font/DOMKH.ttf?url';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PdfExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: ParsedOrder[];
    appData: AppData;
}

type GroupingOption = 'Page' | 'Team' | 'None';
type PageSize = 'a4' | 'a3' | 'letter' | 'legal';
type Orientation = 'portrait' | 'landscape';

interface PdfColumn {
    label: string;
    visible: boolean;
    width: number;
}

interface LoadedFont {
    base64: string;
    name: string;
}

interface KhmerImg {
    dataUrl: string;
    ar: number; // width / height aspect ratio
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (module-level, no closures)
// ─────────────────────────────────────────────────────────────────────────────

/** True when the string contains at least one Khmer Unicode character */
const containsKhmer = (s: string) => /[\u1780-\u17FF]/.test(s);

/**
 * Render `text` using the browser's Kantumruy Pro font (which uses HarfBuzz
 * for correct Khmer shaping / ជើង combining) and return a transparent PNG.
 *
 * @param sizePt  Font size in PDF points (1pt = 1/72 inch)
 * @param cssColor Any valid CSS colour string, e.g. "#ffffff" or "rgb(28,28,30)"
 */
const renderKhmerToImg = (
    text: string,
    sizePt: number,
    cssColor: string,
    bold = false,
): KhmerImg | null => {
    if (!text) return null;
    const SCALE   = 3;                                      // render at 3× for sharpness
    const fontPx  = Math.round(sizePt * 1.3333 * SCALE);   // pt → CSS px → scaled
    const weight  = bold ? '700' : '400';
    const fontStr = `${weight} ${fontPx}px "Kantumruy Pro", "Noto Serif Khmer", sans-serif`;

    // ── Use an off-screen measuring canvas so we never pollute the real canvas ──
    const measure = document.createElement('canvas');
    const mCtx    = measure.getContext('2d')!;
    mCtx.font     = fontStr;
    const textW   = Math.max(1, Math.ceil(mCtx.measureText(text).width));

    // ── Render canvas (sized from measurement — no post-size context reset) ──
    const canvas   = document.createElement('canvas');
    canvas.width   = textW + SCALE * 6;           // horizontal padding
    canvas.height  = Math.ceil(fontPx * 1.6);     // generous line-height
    const ctx      = canvas.getContext('2d')!;
    ctx.font        = fontStr;                     // set AFTER sizing — context is fresh
    ctx.fillStyle   = cssColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, SCALE * 3, canvas.height / 2);
    return { dataUrl: canvas.toDataURL('image/png'), ar: canvas.width / canvas.height };
};

/**
 * Render Khmer text with automatic word-wrap via browser canvas.
 * Lines are broken at '\n' and at word boundaries to fit `maxWidthMm`.
 * Returns a KhmerImg whose aspect ratio encodes the multi-line height.
 */
const renderKhmerMultiline = (
    text: string,
    sizePt: number,
    cssColor: string,
    maxWidthMm: number,
    bold = false,
): KhmerImg | null => {
    if (!text) return null;
    const SCALE   = 3;
    const fontPx  = Math.round(sizePt * 1.3333 * SCALE);
    const weight  = bold ? '700' : '400';
    const fontStr = `${weight} ${fontPx}px "Kantumruy Pro", "Noto Serif Khmer", sans-serif`;
    const maxWPx  = Math.max(1, Math.round(maxWidthMm * 3.7795 * SCALE));

    const measure = document.createElement('canvas');
    const mCtx    = measure.getContext('2d')!;
    mCtx.font     = fontStr;

    // Wrap each paragraph (split at '\n') into display lines
    const finalLines: string[] = [];
    for (const para of text.split('\n')) {
        if (!para.trim()) { finalLines.push(''); continue; }
        const words = para.split(/(\s+)/);
        let line = '';
        for (const w of words) {
            const test = line + w;
            if (!line.trim() || mCtx.measureText(test).width <= maxWPx) {
                line = test;
            } else {
                finalLines.push(line.trimEnd());
                line = w.trimStart();
            }
        }
        if (line.trim()) finalLines.push(line.trim());
    }
    if (!finalLines.length) return null;

    const lineH  = Math.ceil(fontPx * 1.6);
    const canW   = finalLines.reduce(
        (mx, l) => Math.max(mx, Math.ceil(mCtx.measureText(l).width)), 1,
    ) + SCALE * 6;
    const canH   = lineH * finalLines.length + SCALE * 4;

    const canvas  = document.createElement('canvas');
    canvas.width  = canW;
    canvas.height = canH;
    const ctx     = canvas.getContext('2d')!;
    ctx.font       = fontStr;
    ctx.fillStyle  = cssColor;
    ctx.textBaseline = 'middle';
    finalLines.forEach((ln, i) =>
        ctx.fillText(ln, SCALE * 3, SCALE * 2 + lineH * (i + 0.5)),
    );
    return { dataUrl: canvas.toDataURL('image/png'), ar: canvas.width / canvas.height };
};

/** Draw a KhmerImg into a jsPDF doc at a PDF coordinate (all units = mm) */
const placeKhmerImg = (
    doc: any,
    img: KhmerImg,
    x: number,
    y: number,
    maxW: number,
    heightMm: number,
    align: 'left' | 'center' | 'right' = 'left',
) => {
    const h = Math.min(heightMm, maxW / img.ar);
    const w = Math.min(maxW, h * img.ar);
    let dx = x;
    if (align === 'center') dx = x + (maxW - w) / 2;
    else if (align === 'right') dx = x + maxW - w;
    doc.addImage(img.dataUrl, 'PNG', dx, y, w, h);
};

/** Convert an ArrayBuffer → Base64 (chunked to avoid stack overflow) */
const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
    }
    return btoa(binary);
};

/** Return true for TTF / OTF magic bytes; false for WOFF/WOFF2/HTML */
const isValidTTF = (buf: ArrayBuffer): boolean => {
    if (buf.byteLength < 4) return false;
    const m = new Uint8Array(buf, 0, 4);
    if (m[0] === 0x00 && m[1] === 0x01 && m[2] === 0x00 && m[3] === 0x00) return true; // TTF
    if (m[0] === 0x74 && m[1] === 0x72 && m[2] === 0x75 && m[3] === 0x65) return true; // "true"
    if (m[0] === 0x4f && m[1] === 0x54 && m[2] === 0x54 && m[3] === 0x4f) return true; // "OTTO" OTF
    return false;
};

/** Sniff PNG / JPEG / GIF magic bytes from a base64 string */
const getImageFormat = (base64: string): 'JPEG' | 'PNG' | 'GIF' => {
    try {
        const bytes = atob(base64.slice(0, 16));
        if (bytes.charCodeAt(0) === 0xff && bytes.charCodeAt(1) === 0xd8) return 'JPEG';
        if (bytes.charCodeAt(0) === 0x89 && bytes.charCodeAt(1) === 0x50) return 'PNG';
        if (bytes.charCodeAt(0) === 0x47 && bytes.charCodeAt(1) === 0x49) return 'GIF';
    } catch { /* ignore */ }
    return 'JPEG';
};

/**
 * Fetch any image URL and return it as a PNG base64 string (no data: prefix).
 * Uses browser canvas so WebP / AVIF / GIF / SVG all work — jsPDF always
 * receives plain PNG which it handles reliably.
 */
const fetchLogoPng = (url: string): Promise<string> =>
    new Promise(resolve => {
        if (!url) return resolve('');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width  = Math.max(1, img.naturalWidth);
                c.height = Math.max(1, img.naturalHeight);
                c.getContext('2d')!.drawImage(img, 0, 0);
                resolve(c.toDataURL('image/png').split(',')[1]);
            } catch { resolve(''); }
        };
        img.onerror = () => resolve('');
        img.src = url;
    });

/**
 * Draw a logo PNG inside the left-padding area of an autotable cell.
 * Logo is sized to fit within LOGO_AREA_W so it never overlaps the cell text.
 *
 * @param logoAreaW  Available width for the logo in mm (must match LOGO_PAD - gap)
 */
const drawCellLogo = (
    doc: any,
    pngBase64: string,
    x: number,
    y: number,
    cellH: number,
    logoAreaW: number,
) => {
    if (!pngBase64) return;
    const dataUrl = `data:image/png;base64,${pngBase64}`;
    // Fit logo into the reserved area: height ≤ cell height minus padding, width ≤ logoAreaW
    const h = Math.max(2.5, Math.min(cellH - 3, 5));
    const w = Math.min(h * 2.5, logoAreaW);          // allow up to 2.5:1 ratio, cap at area
    try {
        doc.addImage(dataUrl, 'PNG', x + 1, y + (cellH - h) / 2, w, h);
    } catch { /* silently ignore — corrupt or tainted-canvas image */ }
};

/**
 * Load a Khmer TTF for embedding.
 * Priority: Kantumruy Pro (jsDelivr) → DOMKH.ttf (local, always available)
 */
const loadKhmerFont = async (): Promise<LoadedFont | null> => {
    const cdnUrls = [
        'https://cdn.jsdelivr.net/npm/@fontsource/kantumruy-pro/files/kantumruy-pro-khmer-400-normal.ttf',
        'https://cdn.jsdelivr.net/npm/@fontsource/kantumruy-pro@5/files/kantumruy-pro-all-400-normal.ttf',
        'https://cdn.jsdelivr.net/npm/@fontsource/kantumruy/files/kantumruy-khmer-400-normal.ttf',
    ];
    for (const url of cdnUrls) {
        try {
            const res = await fetch(url, { cache: 'force-cache' });
            if (!res.ok) continue;
            const buf = await res.arrayBuffer();
            if (!isValidTTF(buf)) continue;
            return { base64: arrayBufferToBase64(buf), name: 'KantumruyPro' };
        } catch { /* try next */ }
    }
    try {
        const res = await fetch(domkhFontUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (!isValidTTF(buf)) throw new Error('Not a TTF');
        return { base64: arrayBufferToBase64(buf), name: 'MiSansKhmer' };
    } catch (e) {
        console.error('Khmer font load failed:', e);
    }
    return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const PdfExportModal: React.FC<PdfExportModalProps> = ({ isOpen, onClose, orders, appData }) => {
    const [grouping, setGrouping]       = useState<GroupingOption>('Page');
    const [pageSize, setPageSize]       = useState<PageSize>('a4');
    const [orientation, setOrientation] = useState<Orientation>('landscape');
    const [isGenerating, setIsGenerating] = useState(false);

    const [columns, setColumns] = useState<Record<string, PdfColumn>>({
        serialNum: { label: '#',                  visible: true,  width: 8  },
        orderId:   { label: 'Order ID',            visible: true,  width: 24 },
        date:      { label: 'Date',               visible: true,  width: 20 },
        customer:  { label: 'ឈ្មោះអតិថិជន',      visible: true,  width: 34 },
        phone:     { label: 'លេខទូរស័ព្ទ',        visible: true,  width: 30 },
        location:  { label: 'ទីតាំង / អាសយដ្ឋាន', visible: true,  width: 44 },
        items:     { label: 'ទំនិញ',              visible: true,  width: 50 },
        shipping:  { label: 'ដឹកជញ្ជូន',          visible: true,  width: 30 },
        total:     { label: 'សរុប ($)',            visible: true,  width: 20 },
        status:    { label: 'ស្ថានភាព',            visible: true,  width: 20 },
        note:      { label: 'កំណត់ចំណាំ',          visible: false, width: 30 },
    });

    const toggleColumn = (key: string) => {
        setColumns(prev => ({ ...prev, [key]: { ...prev[key], visible: !prev[key].visible } }));
    };

    // ── Phone helpers ──────────────────────────────────────────────────────────

    const formatPhone = (phone: string): string => {
        if (!phone) return '';
        const c = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
        if (c.startsWith('+855')) return '0' + c.slice(4);
        if (c.startsWith('855') && c.length >= 11) return '0' + c.slice(3);
        if (!c.startsWith('0') && /^\d{8,10}$/.test(c)) return '0' + c;
        return c;
    };

    // ── Main PDF generation ────────────────────────────────────────────────────

    const generatePDF = async () => {
        if (isGenerating) return;
        setIsGenerating(true);

        try {
            // ── Step 1: Load fallback font (TTF embedded for Khmer) ───────────
            const loadedFont = await loadKhmerFont();

            // ── Step 2: Pre-fetch logos ────────────────────────────────────────
            const getCarrier = (phone: string) => {
                const fmt = formatPhone(phone);
                return appData.phoneCarriers.find(c =>
                    c.Prefixes.split(',').map(p => p.trim()).some(pfx => fmt.startsWith(pfx))
                ) ?? null;
            };

            const uniqueMethods  = [...new Set(orders.map(o => o['Internal Shipping Method']).filter(Boolean))];
            const uniqueCarriers = new Set<string>();
            orders.forEach(o => { const c = getCarrier(o['Customer Phone']); if (c) uniqueCarriers.add(c.CarrierName); });

            // fetchLogoPng via canvas → always PNG → jsPDF handles it reliably
            // (raw fetch can return WebP/AVIF which jsPDF cannot decode)
            const [shippingEntries, carrierEntries] = await Promise.all([
                Promise.all(uniqueMethods.map(async n => {
                    const m = appData.shippingMethods.find(x => x.MethodName === n);
                    const logoUrl = m?.LogoURL ? convertGoogleDriveUrl(m.LogoURL) : '';
                    return [n, logoUrl ? await fetchLogoPng(logoUrl) : ''] as [string, string];
                })),
                Promise.all([...uniqueCarriers].map(async n => {
                    const c = appData.phoneCarriers.find(x => x.CarrierName === n);
                    const logoUrl = c?.CarrierLogoURL ? convertGoogleDriveUrl(c.CarrierLogoURL) : '';
                    return [n, logoUrl ? await fetchLogoPng(logoUrl) : ''] as [string, string];
                })),
            ]);
            const shippingLogoCache: Record<string, string> = Object.fromEntries(shippingEntries.filter(([, v]) => v));
            const carrierLogoCache:  Record<string, string> = Object.fromEntries(carrierEntries.filter(([, v]) => v));

            // ── Step 3: Ensure Kantumruy Pro is ready in browser canvas ──────────
            // Canvas 2D font rendering is async — if the font is not yet in the
            // browser font cache, fillText() silently falls back to the system
            // default and Khmer shaping breaks.  document.fonts.load() resolves
            // immediately when the font is already loaded (normal case), so this
            // adds negligible overhead while guaranteeing correct glyph shaping.
            try {
                await document.fonts.load('400 32px "Kantumruy Pro"');
                await document.fonts.load('700 32px "Kantumruy Pro"');
            } catch { /* non-critical — canvas will use best available font */ }

            // ── Step 4: Create jsPDF document ─────────────────────────────────
            const doc = new jsPDF({ orientation, unit: 'mm', format: pageSize }) as any;
            if (loadedFont) {
                doc.addFileToVFS(`${loadedFont.name}.ttf`, loadedFont.base64);
                doc.addFont(`${loadedFont.name}.ttf`, loadedFont.name, 'normal');
            }
            const pageW = doc.internal.pageSize.width;

            // ── Step 5: addDocText — draws mixed Khmer+Latin correctly ─────────
            //   Khmer  → browser Canvas2D (HarfBuzz shaping) → PNG embedded in PDF
            //   Latin  → jsPDF native text
            const addDocText = (
                text: string,
                x: number, y: number,
                sizePt: number,
                rgb: [number, number, number],
                align: 'left' | 'center' | 'right' = 'left',
                bold = false,
            ) => {
                if (!text) return;
                if (containsKhmer(text)) {
                    const cssColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
                    const img = renderKhmerToImg(text, sizePt, cssColor, bold);
                    if (!img) return;
                    const hMm = sizePt * 0.35278 * 1.45; // pt → mm with leading
                    const wMm = hMm * img.ar;
                    let dx = x;
                    if (align === 'center') dx = x - wMm / 2;
                    else if (align === 'right') dx = x - wMm;
                    doc.addImage(img.dataUrl, 'PNG', dx, y - hMm * 0.92, wMm, hMm);
                } else {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(sizePt);
                    doc.setTextColor(...rgb);
                    doc.text(text, x, y, { align });
                }
            };

            // ── Step 6: Document header (Friendly style) ──────────────────────
            // Top gradient bar — deep indigo + violet stripe
            doc.setFillColor(79, 70, 229);
            doc.rect(0, 0, pageW, 5, 'F');
            doc.setFillColor(167, 139, 250);
            doc.rect(0, 4.5, pageW, 1, 'F');

            // Header card background
            doc.setFillColor(250, 250, 255);
            doc.rect(0, 5, pageW, 30, 'F');

            // Decorative circle accent — keep fully inside page (x ≥ radius)
            doc.setFillColor(224, 231, 255);
            doc.circle(16, 20, 10, 'F');
            doc.setFillColor(199, 210, 254);
            doc.circle(16, 20, 6, 'F');

            addDocText('របាយការណ៍បញ្ជាទិញ (Orders Report)', pageW / 2, 16, 17, [30, 27, 75], 'center', true);

            // Info pills — pillY is baseline; pill fills pillY-3 to pillY+4
            const pillY = 24;
            // Left pill — date
            doc.setFillColor(224, 231, 255);
            doc.roundedRect(pageW / 2 - 72, pillY - 3, 68, 7, 1.5, 1.5, 'F');
            addDocText(`Generated: ${new Date().toLocaleString()}`, pageW / 2 - 38, pillY + 1, 7.5, [67, 56, 202], 'center');
            // Right pill — count
            doc.setFillColor(220, 252, 231);
            doc.roundedRect(pageW / 2 + 4, pillY - 3, 40, 7, 1.5, 1.5, 'F');
            addDocText(`ចំនួនសរុប: ${orders.length}`, pageW / 2 + 24, pillY + 1, 7.5, [21, 128, 61], 'center');

            // Separator line under header card
            doc.setDrawColor(199, 210, 254);
            doc.setLineWidth(0.5);
            doc.line(0, 35, pageW, 35);

            // ── Step 7: Grouping ───────────────────────────────────────────────
            const groupedData: Record<string, ParsedOrder[]> = {};
            if (grouping === 'None') {
                groupedData['All Orders'] = orders;
            } else {
                orders.forEach(order => {
                    const key = (order[grouping] as string) || 'Unassigned';
                    if (!groupedData[key]) groupedData[key] = [];
                    groupedData[key].push(order);
                });
            }

            // ── Step 8: Column index map ───────────────────────────────────────
            // Object.keys() returns string[] — keeps k typed as string throughout
            // (avoids "symbol cannot be used as index type" from keyof inference)
            const colKeys     = Object.keys(columns);                         // string[]
            const visibleKeys = colKeys.filter(k => columns[k].visible);     // string[]
            const colIdx: Record<string, number> = {};
            visibleKeys.forEach((k, i) => { colIdx[k] = i; });

            const tableHead = [visibleKeys.map(k => columns[k].label)];

            // Pre-render header labels (all contain Khmer except # / Order ID / Date)
            const headerImgCache: Record<number, KhmerImg> = {};
            visibleKeys.forEach((k, i) => {
                const label = columns[k].label;
                if (containsKhmer(label)) {
                    const img = renderKhmerToImg(label, 8, '#FFFFFF', true);
                    if (img) headerImgCache[i] = img;
                }
            });

            // Column widths + logo padding + per-column alignment
            // LOGO_PAD: total left padding of the cell (logo sits in left LOGO_AREA_W of that space)
            const LOGO_PAD      = 11;  // mm — left cell padding for phone/shipping columns
            const LOGO_AREA_W   = 8;   // mm — usable width for the logo image (gap of 3mm before text)
            const columnStyles: Record<number, any> = {};
            visibleKeys.forEach((k, i) => { columnStyles[i] = { cellWidth: columns[k].width }; });
            if (colIdx.serialNum !== undefined) columnStyles[colIdx.serialNum] = { ...columnStyles[colIdx.serialNum], halign: 'center', fontStyle: 'bold' };
            if (colIdx.date      !== undefined) columnStyles[colIdx.date]      = { ...columnStyles[colIdx.date],      halign: 'center' };
            if (colIdx.total     !== undefined) columnStyles[colIdx.total]     = { ...columnStyles[colIdx.total],     halign: 'right'  };
            if (colIdx.status    !== undefined) columnStyles[colIdx.status]    = { ...columnStyles[colIdx.status],    halign: 'center' };
            if (colIdx.phone     !== undefined) columnStyles[colIdx.phone]     = { ...columnStyles[colIdx.phone],     cellPadding: { top: 1.5, bottom: 1.5, right: 2, left: LOGO_PAD } };
            if (colIdx.shipping  !== undefined) columnStyles[colIdx.shipping]  = { ...columnStyles[colIdx.shipping],  cellPadding: { top: 1.5, bottom: 1.5, right: 2, left: LOGO_PAD } };

            let finalY = 38;

            // ── Step 9: Render groups ──────────────────────────────────────────
            Object.entries(groupedData).sort().forEach(([groupName, groupOrders]) => {
                if (finalY > doc.internal.pageSize.height - 30) {
                    doc.addPage();
                    finalY = 15;
                }

                // Group heading bar — warm amber style
                if (grouping !== 'None') {
                    // Amber accent stripe
                    doc.setFillColor(245, 158, 11);
                    doc.rect(14, finalY, 3.5, 10, 'F');
                    // Warm amber background
                    doc.setFillColor(255, 251, 235);
                    doc.rect(17.5, finalY, pageW - 31.5, 10, 'F');
                    // Outer border
                    doc.setDrawColor(253, 224, 71);
                    doc.setLineWidth(0.3);
                    doc.rect(14, finalY, pageW - 28, 10, 'S');
                    addDocText(
                        `${groupName}  (${groupOrders.length} orders)`,
                        24, finalY + 6.8, 10, [120, 53, 15],
                    );
                    finalY += 13;
                }

                // Build tableBody + track Khmer cells for this group
                const khmerCellMap: Record<number, Record<number, string>> = {};
                const khmerBodyCache: Record<string, KhmerImg> = {};

                const tableBody = groupOrders.map((order, rowIdx) => {
                    const row: any[] = [];
                    let ci = 0;
                    // skipPrerender: location cells render on-the-fly (need cell.width)
                    const push = (value: any, skipPrerender = false) => {
                        const str = String(value ?? '');
                        if (containsKhmer(str)) {
                            if (!khmerCellMap[rowIdx]) khmerCellMap[rowIdx] = {};
                            khmerCellMap[rowIdx][ci] = str;
                            if (!skipPrerender && !khmerBodyCache[str]) {
                                const img = renderKhmerToImg(str, 8, '#1E293B');
                                if (img) khmerBodyCache[str] = img;
                            }
                        }
                        row.push(value ?? '');
                        ci++;
                    };

                    if (columns.serialNum.visible) push(rowIdx + 1);
                    if (columns.orderId.visible)   push(order['Order ID'] || '');
                    if (columns.date.visible)      push(new Date(order.Timestamp).toLocaleDateString('en-GB'));
                    if (columns.customer.visible)  push(order['Customer Name'] || '');
                    if (columns.phone.visible)     push(formatPhone(order['Customer Phone']));
                    // Location: join with '\n' so multiline renderer splits correctly; skip pre-render
                    if (columns.location.visible)  push([order.Location, order['Address Details']].filter(Boolean).join('\n'), true);
                    if (columns.items.visible)     push(order.Products.map(p => `${p.quantity}x ${p.name}`).join(', '));
                    if (columns.shipping.visible)  push(order['Internal Shipping Method'] || '');
                    if (columns.total.visible)     push(`$${(order['Grand Total'] || 0).toFixed(2)}`);
                    if (columns.status.visible)    push(order['Payment Status'] || '');
                    if (columns.note.visible)      push(order.Note || '');
                    return row;
                });

                const groupTotal = groupOrders.reduce((s, o) => s + (o['Grand Total'] || 0), 0);

                doc.autoTable({
                    startY: finalY,
                    head: tableHead,
                    body: tableBody,
                    theme: 'grid',
                    tableLineWidth: 0.3,
                    tableLineColor: [199, 210, 254],   // indigo-200
                    headStyles: {
                        fillColor: [79, 70, 229],      // indigo-600
                        textColor: [255, 255, 255],
                        fontSize: 8,
                        minCellHeight: 10,
                        halign: 'center',
                        lineWidth: 0.3,
                        lineColor: [99, 102, 241],     // indigo-500
                    },
                    styles: {
                        fontSize: 8,
                        cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
                        overflow: 'linebreak',
                        lineWidth: 0.2,
                        lineColor: [199, 210, 254],    // indigo-200
                        textColor: [15, 23, 42],       // slate-900
                    },
                    alternateRowStyles: {
                        fillColor: [238, 242, 255],    // indigo-50
                    },
                    columnStyles,
                    margin: { top: 20, left: 14, right: 14, bottom: 16 },

                    // ── willDrawCell: suppress text that we'll draw ourselves ──
                    willDrawCell: (data: any) => {
                        if (data.section === 'head') {
                            if (headerImgCache[data.column.index]) {
                                data.cell.text = [''];
                            }
                        }
                        if (data.section === 'body') {
                            const khText = khmerCellMap[data.row.index]?.[data.column.index];
                            if (khText) {
                                if (data.column.index === colIdx.location) {
                                    // Allocate correct row height: one empty line per '\n'-separated segment
                                    const lineCount = Math.max(1, khText.split('\n').filter(Boolean).length);
                                    data.cell.text = Array(lineCount).fill('');
                                } else {
                                    data.cell.text = [''];
                                }
                            }
                            if (data.column.index === colIdx.status) {
                                data.cell.text = [''];
                            }
                        }
                    },

                    // ── didDrawCell: draw canvas-rendered images + logos ───────
                    didDrawCell: (data: any) => {
                        const { cell, section, column, row } = data;
                        const order = groupOrders[row.index];

                        // Header Khmer labels
                        if (section === 'head') {
                            const img = headerImgCache[column.index];
                            if (img) {
                                const maxH = Math.min(cell.height - 2, 6);
                                placeKhmerImg(doc, img, cell.x + 1, cell.y + (cell.height - maxH) / 2, cell.width - 2, maxH, 'center');
                            }
                        }

                        if (section === 'body') {
                            const khText = khmerCellMap[row.index]?.[column.index];

                            if (khText) {
                                if (column.index === colIdx.location) {
                                    // ── Multi-line location: render on-the-fly with actual cell width ──
                                    const padL = 2.5; const padT = 2;
                                    const maxW = cell.width - padL * 2;
                                    const img = renderKhmerMultiline(khText, 7.5, '#1E293B', maxW);
                                    if (img) {
                                        const drawH = Math.min(cell.height - padT * 2, maxW / img.ar);
                                        const drawW = Math.min(maxW, drawH * img.ar);
                                        doc.addImage(img.dataUrl, 'PNG', cell.x + padL, cell.y + padT, drawW, drawH);
                                    }
                                } else {
                                    // ── Single-line Khmer for other columns ──
                                    const img = khmerBodyCache[khText];
                                    if (img) {
                                        const padL = (column.index === colIdx.phone || column.index === colIdx.shipping) ? LOGO_PAD : 2.5;
                                        const maxH = Math.min(cell.height - 2.5, 5.5);
                                        const maxW = cell.width - padL - 1.5;
                                        placeKhmerImg(doc, img, cell.x + padL, cell.y + (cell.height - maxH) / 2, maxW, maxH);
                                    }
                                }
                            }

                            if (!order) return;

                            // Phone carrier logo
                            if (column.index === colIdx.phone) {
                                const carrier = getCarrier(order['Customer Phone']);
                                if (carrier) {
                                    const logo = carrierLogoCache[carrier.CarrierName];
                                    if (logo) drawCellLogo(doc, logo, cell.x, cell.y, cell.height, LOGO_AREA_W);
                                }
                            }

                            // Shipping service logo
                            if (column.index === colIdx.shipping) {
                                const logo = shippingLogoCache[order['Internal Shipping Method']];
                                if (logo) drawCellLogo(doc, logo, cell.x, cell.y, cell.height, LOGO_AREA_W);
                            }

                            // ── Payment Status badge ──────────────────────────────
                            if (column.index === colIdx.status) {
                                const statusText = String((cell as any).raw ?? '').trim();
                                const lower      = statusText.toLowerCase();
                                const isPaid     = lower === 'paid';
                                const isUnpaid   = lower === 'unpaid' || lower === 'pending';
                                if (isPaid || isUnpaid) {
                                    const bg     = isPaid ? [220, 252, 231] : [254, 226, 226];
                                    const fg     = isPaid ? [21, 128, 61]   : [185, 28, 28];
                                    const border = isPaid ? [134, 239, 172] : [252, 165, 165];
                                    const padX = 3; const padY = 2;
                                    const bx = cell.x + padX;
                                    const by = cell.y + padY;
                                    const bw = cell.width  - padX * 2;
                                    const bh = cell.height - padY * 2;
                                    doc.setFillColor(...bg);
                                    doc.roundedRect(bx, by, bw, bh, 1, 1, 'F');
                                    doc.setDrawColor(...border);
                                    doc.setLineWidth(0.25);
                                    doc.roundedRect(bx, by, bw, bh, 1, 1, 'S');
                                    doc.setFont('helvetica', 'bold');
                                    doc.setFontSize(7.5);
                                    doc.setTextColor(...fg);
                                    doc.text(statusText, cell.x + cell.width / 2, cell.y + cell.height / 2,
                                        { align: 'center', baseline: 'middle' });
                                    doc.setFont('helvetica', 'normal');
                                    doc.setTextColor(15, 23, 42);
                                }
                            }
                        }
                    },
                });

                finalY = doc.lastAutoTable.finalY + 3;

                if (grouping !== 'None') {
                    // Subtotal pill — indigo-tinted, rounded
                    const stW = 62; const stH = 8;
                    const stX = pageW - 14 - stW;
                    doc.setFillColor(238, 242, 255);       // indigo-50
                    doc.roundedRect(stX, finalY, stW, stH, 2, 2, 'F');
                    doc.setDrawColor(199, 210, 254);       // indigo-200
                    doc.setLineWidth(0.3);
                    doc.roundedRect(stX, finalY, stW, stH, 2, 2, 'S');
                    doc.setFillColor(79, 70, 229);          // indigo-600 accent dot
                    doc.circle(stX + 5, finalY + stH / 2, 1.5, 'F');
                    addDocText(`សរុបក្រុម: $${groupTotal.toFixed(2)}`, pageW - 16, finalY + stH * 0.7, 9, [67, 56, 202], 'right');
                    finalY += stH + 7;
                } else {
                    finalY += 5;
                }
            });

            // Grand total — solid indigo pill with a simple left stripe accent
            if (grouping === 'None') {
                const grand = orders.reduce((s, o) => s + (o['Grand Total'] || 0), 0);
                const gtW = 75; const gtH = 10;
                const gtX = pageW - 14 - gtW;
                // 1. Main pill
                doc.setFillColor(79, 70, 229);
                doc.roundedRect(gtX, finalY, gtW, gtH, 2.5, 2.5, 'F');
                // 2. Accent stripe — drawn as a plain rect INSIDE the pill so rounded
                //    corners of the main box clip it naturally (no artifact)
                doc.setFillColor(139, 92, 246);            // violet-500
                doc.rect(gtX + 2.5, finalY, 6, gtH, 'F'); // sits within rounded radius zone
                // 3. Re-draw main fill on the right part so stripe blends cleanly
                doc.setFillColor(79, 70, 229);
                doc.rect(gtX + 8.5, finalY, gtW - 8.5, gtH, 'F');
                addDocText(`សរុបទឹកប្រាក់: $${grand.toFixed(2)}`, pageW - 16, finalY + gtH * 0.72, 11, [255, 255, 255], 'right', true);
            }

            // Page numbers + footer + outer border
            const pageCount = doc.internal.pages.length - 1;
            const pageH = doc.internal.pageSize.height;
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setDrawColor(199, 210, 254);  // indigo-200
                doc.setLineWidth(0.4);
                if (i === 1) {
                    // Page 1: header fill covers y=0→35, so skip the top border line.
                    // Draw only left, right, and bottom sides manually.
                    doc.line(4,          4,          4,          pageH - 4); // left
                    doc.line(pageW - 4,  4,          pageW - 4,  pageH - 4); // right
                    doc.line(4,          pageH - 4,  pageW - 4,  pageH - 4); // bottom
                } else {
                    // Page 2+: full border on all 4 sides
                    doc.rect(4, 4, pageW - 8, pageH - 8, 'S');
                }
                // Bottom footer bar (all pages)
                doc.setFillColor(249, 250, 255);
                doc.rect(4, pageH - 12, pageW - 8, 8, 'F');
                doc.setDrawColor(199, 210, 254);
                doc.setLineWidth(0.3);
                doc.line(4, pageH - 12, pageW - 4, pageH - 12);
                addDocText(`ទំព័រ ${i} នៃ ${pageCount}`, pageW / 2, pageH - 7, 8, [107, 114, 128], 'center');
            }

            doc.save(`Orders_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
            setIsGenerating(false);
            onClose();
        } catch (err) {
            console.error('PDF Generation Error:', err);
            alert('Failed to generate PDF. Check console for details.');
            setIsGenerating(false);
        }
    };

    // ── UI ──────────────────────────────────────────────────────────────────────

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    ទាញយកជា PDF
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            <div className="space-y-6">
                {/* General settings */}
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-blue-300 mb-3">ការកំណត់ទូទៅ</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">ទំហំ (Size)</label>
                            <select value={pageSize} onChange={e => setPageSize(e.target.value as PageSize)} className="form-select bg-gray-900 border-gray-700 w-full">
                                <option value="a4">A4</option>
                                <option value="a3">A3</option>
                                <option value="letter">Letter</option>
                                <option value="legal">Legal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">ទិសដៅ</label>
                            <select value={orientation} onChange={e => setOrientation(e.target.value as Orientation)} className="form-select bg-gray-900 border-gray-700 w-full">
                                <option value="portrait">បញ្ឈរ (Portrait)</option>
                                <option value="landscape">ប្ដេក (Landscape)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">ចែកក្រុម (Group By)</label>
                            <select value={grouping} onChange={e => setGrouping(e.target.value as GroupingOption)} className="form-select bg-gray-900 border-gray-700 w-full">
                                <option value="Page">Page</option>
                                <option value="Team">Team</option>
                                <option value="None">None</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Column toggles */}
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-blue-300 mb-3">Columns</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.keys(columns).map(key => (
                            <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/60 p-2 rounded transition-colors">
                                <input
                                    type="checkbox"
                                    checked={columns[key].visible}
                                    onChange={() => toggleColumn(key)}
                                    className="h-4 w-4 text-blue-600 rounded border-gray-500 bg-gray-900"
                                />
                                <span className="text-sm text-gray-200">{columns[key].label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Note */}
                <p className="text-xs text-gray-500 px-1">
                    អក្សរខ្មែរ render តាម browser canvas (ជើង / vowel signs ត្រឹមត្រូវ) ·
                    លេខទូរស័ព្ទ format ចាប់ផ្ដើមដោយ <span className="text-gray-300 font-mono">0</span> ·
                    Logo បង្ហាញបើ internet ព្រម
                </p>

                {/* Actions */}
                <div className="flex justify-end pt-4 gap-3 border-t border-gray-700">
                    <button onClick={onClose} className="btn btn-secondary">បោះបង់</button>
                    <button
                        onClick={generatePDF}
                        disabled={isGenerating}
                        className="btn btn-primary flex items-center gap-2 shadow-lg"
                    >
                        {isGenerating
                            ? <><Spinner size="sm" /><span>កំពុងដំណើរការ…</span></>
                            : <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                ទាញយក PDF
                            </>
                        }
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PdfExportModal;
