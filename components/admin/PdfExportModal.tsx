
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ParsedOrder, AppData } from '../../types';
import Spinner from '../common/Spinner';
import { imageUrlToBase64 } from '../../utils/fileUtils';

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

/** Draw a service logo in the left-padding area of an autotable cell */
const drawCellLogo = (doc: any, base64: string, x: number, y: number, cellH: number) => {
    if (!base64) return;
    // jsPDF 2.x addImage requires a proper data-URL string (not raw base64)
    const fmt      = getImageFormat(base64);
    const mimeType = fmt === 'PNG' ? 'image/png' : fmt === 'GIF' ? 'image/gif' : 'image/jpeg';
    const dataUrl  = `data:${mimeType};base64,${base64}`;
    const h = Math.max(3, Math.min(cellH - 2, 5.5));
    const w = h * 1.5;
    try { doc.addImage(dataUrl, fmt, x + 0.8, y + (cellH - h) / 2, w, h); }
    catch { /* silently ignore corrupt / CORS-blocked images */ }
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
            // ── Step 1: Load fallback font for Latin / non-Khmer text ─────────
            const loadedFont = await loadKhmerFont();
            const FONT_NAME  = loadedFont?.name ?? 'helvetica';

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

            const [shippingEntries, carrierEntries] = await Promise.all([
                Promise.all(uniqueMethods.map(async n => {
                    const m = appData.shippingMethods.find(x => x.MethodName === n);
                    return [n, m?.LogoURL ? await imageUrlToBase64(m.LogoURL) : ''] as [string, string];
                })),
                Promise.all([...uniqueCarriers].map(async n => {
                    const c = appData.phoneCarriers.find(x => x.CarrierName === n);
                    return [n, c?.CarrierLogoURL ? await imageUrlToBase64(c.CarrierLogoURL) : ''] as [string, string];
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
            const setFont = () => { if (loadedFont) doc.setFont(FONT_NAME, 'normal'); };
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

            // ── Step 6: Document header ────────────────────────────────────────
            // Top accent bar
            doc.setFillColor(30, 42, 68);
            doc.rect(0, 0, pageW, 4, 'F');
            doc.setFillColor(59, 130, 246);
            doc.rect(0, 3.5, pageW, 1, 'F');

            addDocText('របាយការណ៍បញ្ជាទិញ (Orders Report)', pageW / 2, 15, 16, [30, 30, 30], 'center', true);
            addDocText(`Generated: ${new Date().toLocaleString()}`,  pageW / 2, 22, 9, [110, 110, 110], 'center');
            addDocText(`ចំនួនបញ្ជាទិញ: ${orders.length}`,           pageW / 2, 27, 9, [110, 110, 110], 'center');

            // Separator line under header
            doc.setDrawColor(200, 210, 230);
            doc.setLineWidth(0.4);
            doc.line(14, 31, pageW - 14, 31);

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
            const LOGO_PAD = 9; // mm left padding in logo columns
            const columnStyles: Record<number, any> = {};
            visibleKeys.forEach((k, i) => { columnStyles[i] = { cellWidth: columns[k].width }; });
            if (colIdx.serialNum !== undefined) columnStyles[colIdx.serialNum] = { ...columnStyles[colIdx.serialNum], halign: 'center', fontStyle: 'bold' };
            if (colIdx.total     !== undefined) columnStyles[colIdx.total]     = { ...columnStyles[colIdx.total],     halign: 'right'  };
            if (colIdx.status    !== undefined) columnStyles[colIdx.status]    = { ...columnStyles[colIdx.status],    halign: 'center' };
            if (colIdx.phone     !== undefined) columnStyles[colIdx.phone]     = { ...columnStyles[colIdx.phone],     cellPadding: { top: 1.5, bottom: 1.5, right: 2, left: LOGO_PAD } };
            if (colIdx.shipping  !== undefined) columnStyles[colIdx.shipping]  = { ...columnStyles[colIdx.shipping],  cellPadding: { top: 1.5, bottom: 1.5, right: 2, left: LOGO_PAD } };

            let finalY = 34;

            // ── Step 9: Render groups ──────────────────────────────────────────
            Object.entries(groupedData).sort().forEach(([groupName, groupOrders]) => {
                if (finalY > doc.internal.pageSize.height - 30) {
                    doc.addPage();
                    finalY = 15;
                }

                // Group heading bar
                if (grouping !== 'None') {
                    // Left accent stripe
                    doc.setFillColor(59, 130, 246);
                    doc.rect(14, finalY, 3, 9, 'F');
                    // Main background
                    doc.setFillColor(239, 246, 255);
                    doc.rect(17, finalY, pageW - 31, 9, 'F');
                    // Outer border
                    doc.setDrawColor(147, 197, 253);
                    doc.setLineWidth(0.3);
                    doc.rect(14, finalY, pageW - 28, 9, 'S');
                    addDocText(
                        `${groupName}  (${groupOrders.length} orders)`,
                        22, finalY + 6.2, 10, [30, 64, 175],
                    );
                    finalY += 12;
                }

                // Build tableBody + track Khmer cells for this group
                const khmerCellMap: Record<number, Record<number, string>> = {};
                const khmerBodyCache: Record<string, KhmerImg> = {};

                const tableBody = groupOrders.map((order, rowIdx) => {
                    const row: any[] = [];
                    let ci = 0;
                    const push = (value: any) => {
                        const str = String(value ?? '');
                        if (containsKhmer(str)) {
                            if (!khmerCellMap[rowIdx]) khmerCellMap[rowIdx] = {};
                            khmerCellMap[rowIdx][ci] = str;
                            if (!khmerBodyCache[str]) {
                                const img = renderKhmerToImg(str, 8, '#1C1C1E');
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
                    if (columns.location.visible)  push([order.Location, order['Address Details']].filter(Boolean).join(' - '));
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
                    tableLineWidth: 0.35,
                    tableLineColor: [120, 140, 180],
                    headStyles: {
                        fillColor: [30, 42, 68],
                        textColor: [255, 255, 255],
                        fontSize: 8,
                        minCellHeight: 9,
                        halign: 'center',
                        lineWidth: 0.3,
                        lineColor: [80, 100, 140],
                    },
                    styles: {
                        fontSize: 8,
                        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
                        overflow: 'linebreak',
                        lineWidth: 0.25,
                        lineColor: [190, 200, 220],
                        textColor: [25, 25, 30],
                    },
                    alternateRowStyles: {
                        fillColor: [245, 247, 252],
                    },
                    columnStyles,
                    margin: { top: 20, left: 14, right: 14 },

                    // ── willDrawCell: suppress garbled Khmer text ──────────────
                    willDrawCell: (data: any) => {
                        if (data.section === 'head') {
                            if (headerImgCache[data.column.index]) {
                                data.cell.text = ['']; // prevent garbled header
                            }
                        }
                        if (data.section === 'body') {
                            if (khmerCellMap[data.row.index]?.[data.column.index]) {
                                data.cell.text = ['']; // prevent garbled body text
                            }
                        }
                    },

                    // ── didDrawCell: draw canvas-rendered images + logos ───────
                    didDrawCell: (data: any) => {
                        const { cell, section, column, row } = data;
                        const order = groupOrders[row.index];

                        // Header Khmer labels → browser-rendered PNG
                        if (section === 'head') {
                            const img = headerImgCache[column.index];
                            if (img) {
                                const maxH = Math.min(cell.height - 1.5, 5);
                                placeKhmerImg(doc, img, cell.x + 1, cell.y + (cell.height - maxH) / 2, cell.width - 2, maxH, 'center');
                            }
                        }

                        // Body Khmer text → browser-rendered PNG
                        if (section === 'body') {
                            const khText = khmerCellMap[row.index]?.[column.index];
                            if (khText) {
                                const img = khmerBodyCache[khText];
                                if (img) {
                                    const padL = (column.index === colIdx.phone || column.index === colIdx.shipping) ? LOGO_PAD : 2;
                                    const maxH = Math.min(cell.height - 2, 5);
                                    const maxW = cell.width - padL - 1;
                                    placeKhmerImg(doc, img, cell.x + padL, cell.y + (cell.height - maxH) / 2, maxW, maxH);
                                }
                            }

                            if (!order) return;

                            // Phone carrier logo
                            if (column.index === colIdx.phone) {
                                const carrier = getCarrier(order['Customer Phone']);
                                if (carrier) {
                                    const logo = carrierLogoCache[carrier.CarrierName];
                                    if (logo) drawCellLogo(doc, logo, cell.x, cell.y, cell.height);
                                }
                            }

                            // Shipping service logo
                            if (column.index === colIdx.shipping) {
                                const logo = shippingLogoCache[order['Internal Shipping Method']];
                                if (logo) drawCellLogo(doc, logo, cell.x, cell.y, cell.height);
                            }
                        }
                    },
                });

                finalY = doc.lastAutoTable.finalY + 2;

                if (grouping !== 'None') {
                    // Subtotal pill box
                    const stW = 58; const stH = 7;
                    const stX = pageW - 14 - stW;
                    doc.setFillColor(239, 246, 255);
                    doc.rect(stX, finalY, stW, stH, 'F');
                    doc.setDrawColor(147, 197, 253);
                    doc.setLineWidth(0.35);
                    doc.rect(stX, finalY, stW, stH, 'S');
                    // Left accent on subtotal
                    doc.setFillColor(59, 130, 246);
                    doc.rect(stX, finalY, 2.5, stH, 'F');
                    addDocText(`សរុបក្រុម: $${groupTotal.toFixed(2)}`, pageW - 16, finalY + stH * 0.72, 9, [30, 64, 175], 'right');
                    finalY += stH + 6;
                } else {
                    finalY += 4;
                }
            });

            // Grand total dark box
            if (grouping === 'None') {
                const grand = orders.reduce((s, o) => s + (o['Grand Total'] || 0), 0);
                const gtW = 70; const gtH = 9;
                const gtX = pageW - 14 - gtW;
                doc.setFillColor(30, 42, 68);
                doc.rect(gtX, finalY, gtW, gtH, 'F');
                doc.setFillColor(59, 130, 246);
                doc.rect(gtX, finalY, 3, gtH, 'F');
                addDocText(`សរុបទឹកប្រាក់: $${grand.toFixed(2)}`, pageW - 16, finalY + gtH * 0.72, 11, [255, 255, 255], 'right', true);
            }

            // Page numbers + footer line
            const pageCount = doc.internal.pages.length - 1;
            const pageH = doc.internal.pageSize.height;
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setDrawColor(200, 210, 230);
                doc.setLineWidth(0.3);
                doc.line(14, pageH - 9, pageW - 14, pageH - 9);
                addDocText(`ទំព័រ ${i} នៃ ${pageCount}`, pageW / 2, pageH - 5, 8, [150, 150, 150], 'center');
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
