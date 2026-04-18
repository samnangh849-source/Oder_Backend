
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ParsedOrder, AppData } from '../../types';
import Spinner from '../common/Spinner';
import { imageUrlToBase64 } from '../../utils/fileUtils';

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

// ---- Helpers ----

/** Ensure every Cambodian phone number starts with a leading 0 */
const formatPhone = (phone: string): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    // +855XXXXXXXXX → 0XXXXXXXXX
    if (cleaned.startsWith('+855')) return '0' + cleaned.slice(4);
    // 855XXXXXXXXX → 0XXXXXXXXX
    if (cleaned.startsWith('855') && cleaned.length >= 11) return '0' + cleaned.slice(3);
    // 8-10 digits with no leading 0 → prepend 0
    if (!cleaned.startsWith('0') && /^\d{8,10}$/.test(cleaned)) return '0' + cleaned;
    return cleaned;
};

/** Convert an ArrayBuffer to a Base64 string in chunks to avoid stack overflow */
const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
    }
    return btoa(binary);
};

/** Sniff the first bytes of a Base64 blob to determine image format for jsPDF */
const getImageFormat = (base64: string): 'JPEG' | 'PNG' | 'GIF' => {
    try {
        const bytes = atob(base64.slice(0, 16));
        if (bytes.charCodeAt(0) === 0xff && bytes.charCodeAt(1) === 0xd8) return 'JPEG';
        if (bytes.charCodeAt(0) === 0x89 && bytes.charCodeAt(1) === 0x50) return 'PNG';
        if (bytes.charCodeAt(0) === 0x47 && bytes.charCodeAt(1) === 0x49) return 'GIF';
    } catch { /* ignore */ }
    return 'JPEG';
};

/** Try to draw a base64 logo image inside a jsPDF-autotable cell */
const drawCellLogo = (doc: any, base64: string, x: number, y: number, cellH: number) => {
    if (!base64) return;
    const fmt = getImageFormat(base64);
    const h = Math.max(3, Math.min(cellH - 2, 5.5));
    const w = h * 1.5;
    try {
        doc.addImage(base64, fmt, x + 0.8, y + (cellH - h) / 2, w, h);
    } catch { /* silently ignore corrupt / unsupported image */ }
};

/**
 * Fetch Kantumruy Pro font as a Base64-encoded TTF string.
 * Tries jsDelivr (@fontsource) first, then falls back gracefully.
 */
const loadKantumruyFont = async (): Promise<string | null> => {
    const candidates = [
        'https://cdn.jsdelivr.net/npm/@fontsource/kantumruy-pro/files/kantumruy-pro-khmer-400-normal.ttf',
        'https://cdn.jsdelivr.net/npm/@fontsource/kantumruy-pro@5/files/kantumruy-pro-all-400-normal.ttf',
        'https://cdn.jsdelivr.net/npm/@fontsource/kantumruy/files/kantumruy-khmer-400-normal.ttf',
    ];
    for (const url of candidates) {
        try {
            const res = await fetch(url, { cache: 'force-cache' });
            if (!res.ok) continue;
            const buf = await res.arrayBuffer();
            // Validate TTF magic bytes (0x00010000 or "OTTO" or "true")
            const magic = new Uint8Array(buf, 0, 4);
            const isOTF = magic[0] === 0x4f && magic[1] === 0x54; // "OT"
            const isTTF =
                (magic[0] === 0x00 && magic[1] === 0x01 && magic[2] === 0x00 && magic[3] === 0x00) ||
                (magic[0] === 0x74 && magic[1] === 0x72 && magic[2] === 0x75 && magic[3] === 0x65) || // "true"
                isOTF;
            if (!isTTF) continue; // Skip WOFF/WOFF2 – jsPDF can't use them
            return arrayBufferToBase64(buf);
        } catch { /* try next */ }
    }
    return null; // font unavailable; PDF will still generate without Khmer rendering
};

// ---- Component ----

const PdfExportModal: React.FC<PdfExportModalProps> = ({ isOpen, onClose, orders, appData }) => {
    const [grouping, setGrouping] = useState<GroupingOption>('Page');
    const [pageSize, setPageSize] = useState<PageSize>('a4');
    const [orientation, setOrientation] = useState<Orientation>('landscape');
    const [isGenerating, setIsGenerating] = useState(false);

    const [columns, setColumns] = useState<Record<string, PdfColumn>>({
        serialNum:  { label: '#',                 visible: true,  width: 8  },
        orderId:    { label: 'Order ID',           visible: true,  width: 24 },
        date:       { label: 'Date',              visible: true,  width: 20 },
        customer:   { label: 'ឈ្មោះអតិថិជន',     visible: true,  width: 34 },
        phone:      { label: 'លេខទូរស័ព្ទ',       visible: true,  width: 30 },
        location:   { label: 'ទីតាំង / អាសយដ្ឋាន', visible: true,  width: 44 },
        items:      { label: 'ទំនិញ',             visible: true,  width: 50 },
        shipping:   { label: 'ដឹកជញ្ជូន',         visible: true,  width: 30 },
        total:      { label: 'សរុប ($)',           visible: true,  width: 20 },
        status:     { label: 'ស្ថានភាព',           visible: true,  width: 20 },
        note:       { label: 'កំណត់ចំណាំ',         visible: false, width: 30 },
    });

    const toggleColumn = (key: keyof typeof columns) => {
        setColumns(prev => ({
            ...prev,
            [key]: { ...prev[key], visible: !prev[key].visible },
        }));
    };

    const generatePDF = async () => {
        if (isGenerating) return;
        setIsGenerating(true);

        try {
            // ── 1. Load Kantumruy font ──────────────────────────────────────
            const fontBase64 = await loadKantumruyFont();
            const FONT_NAME = 'KantumruyPro';

            // ── 2. Pre-fetch all logos in parallel ─────────────────────────
            const getCarrierForPhone = (phone: string) => {
                const fmt = formatPhone(phone);
                return appData.phoneCarriers.find(c =>
                    c.Prefixes.split(',').map(p => p.trim()).some(prefix => fmt.startsWith(prefix))
                ) ?? null;
            };

            const uniqueMethodNames = [...new Set(orders.map(o => o['Internal Shipping Method']).filter(Boolean))];
            const uniqueCarrierNames = new Set<string>();
            orders.forEach(o => { const c = getCarrierForPhone(o['Customer Phone']); if (c) uniqueCarrierNames.add(c.CarrierName); });

            const [shippingLogoEntries, carrierLogoEntries] = await Promise.all([
                Promise.all(uniqueMethodNames.map(async name => {
                    const m = appData.shippingMethods.find(x => x.MethodName === name);
                    if (!m?.LogoURL) return [name, ''] as [string, string];
                    const b64 = await imageUrlToBase64(m.LogoURL);
                    return [name, b64] as [string, string];
                })),
                Promise.all([...uniqueCarrierNames].map(async name => {
                    const c = appData.phoneCarriers.find(x => x.CarrierName === name);
                    if (!c?.CarrierLogoURL) return [name, ''] as [string, string];
                    const b64 = await imageUrlToBase64(c.CarrierLogoURL);
                    return [name, b64] as [string, string];
                })),
            ]);

            const shippingLogoCache: Record<string, string> = Object.fromEntries(shippingLogoEntries.filter(([, v]) => v));
            const carrierLogoCache:  Record<string, string> = Object.fromEntries(carrierLogoEntries.filter(([, v]) => v));

            // ── 3. Create document ─────────────────────────────────────────
            const doc = new jsPDF({ orientation, unit: 'mm', format: pageSize }) as any;

            if (fontBase64) {
                doc.addFileToVFS('KantumruyPro-Regular.ttf', fontBase64);
                doc.addFont('KantumruyPro-Regular.ttf', FONT_NAME, 'normal');
            }
            const useKhmer = () => { if (fontBase64) doc.setFont(FONT_NAME, 'normal'); };

            const pageW = doc.internal.pageSize.width;

            // ── 4. Document header ─────────────────────────────────────────
            useKhmer();
            doc.setFontSize(16);
            doc.setTextColor(30, 30, 30);
            doc.text('របាយការណ៍បញ្ជាទិញ (Orders Report)', pageW / 2, 14, { align: 'center' });

            doc.setFontSize(9);
            doc.setTextColor(110, 110, 110);
            doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, 20, { align: 'center' });
            doc.text(`ចំនួនបញ្ជាទិញសរុប: ${orders.length}`, pageW / 2, 25, { align: 'center' });

            // ── 5. Group orders ────────────────────────────────────────────
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

            // ── 6. Build visible-column index map ──────────────────────────
            const colKeys = Object.keys(columns) as Array<keyof typeof columns>;
            const visibleKeys = colKeys.filter(k => columns[k].visible);
            const colIdx: Record<string, number> = {};
            visibleKeys.forEach((k, i) => { colIdx[k] = i; });

            const tableHead = [visibleKeys.map(k => columns[k].label)];

            // Column widths + extra left-padding for logo columns
            const columnStyles: Record<number, any> = {};
            visibleKeys.forEach((k, i) => {
                columnStyles[i] = { cellWidth: columns[k].width };
            });
            const LOGO_LEFT_PAD = 9; // mm reserved for the logo image
            if (colIdx.phone    !== undefined) columnStyles[colIdx.phone]    = { ...columnStyles[colIdx.phone],    cellPadding: { top: 1.5, bottom: 1.5, right: 2, left: LOGO_LEFT_PAD } };
            if (colIdx.shipping !== undefined) columnStyles[colIdx.shipping] = { ...columnStyles[colIdx.shipping], cellPadding: { top: 1.5, bottom: 1.5, right: 2, left: LOGO_LEFT_PAD } };

            let finalY = 30;

            // ── 7. Render each group ───────────────────────────────────────
            Object.entries(groupedData).sort().forEach(([groupName, groupOrders]) => {
                if (finalY > doc.internal.pageSize.height - 30) {
                    doc.addPage();
                    finalY = 15;
                }

                // Group heading bar
                if (grouping !== 'None') {
                    useKhmer();
                    doc.setFontSize(11);
                    doc.setTextColor(30, 64, 175);
                    doc.setFillColor(235, 240, 255);
                    doc.rect(14, finalY, pageW - 28, 8, 'F');
                    doc.text(`${grouping}: ${groupName}  (${groupOrders.length} orders)`, 16, finalY + 5.5);
                    finalY += 10;
                }

                // Build table body rows
                const tableBody = groupOrders.map((order, rowIdx) => {
                    const row: any[] = [];
                    if (columns.serialNum.visible)  row.push(rowIdx + 1);
                    if (columns.orderId.visible)     row.push(order['Order ID'] || '');
                    if (columns.date.visible)        row.push(new Date(order.Timestamp).toLocaleDateString('en-GB'));
                    if (columns.customer.visible)    row.push(order['Customer Name'] || '');
                    if (columns.phone.visible)       row.push(formatPhone(order['Customer Phone']));
                    if (columns.location.visible)    row.push([order.Location, order['Address Details']].filter(Boolean).join(' - '));
                    if (columns.items.visible)       row.push(order.Products.map(p => `${p.quantity}x ${p.name}`).join(', '));
                    if (columns.shipping.visible)    row.push(order['Internal Shipping Method'] || '');
                    if (columns.total.visible)       row.push(`$${(order['Grand Total'] || 0).toFixed(2)}`);
                    if (columns.status.visible)      row.push(order['Payment Status'] || '');
                    if (columns.note.visible)        row.push(order.Note || '');
                    return row;
                });

                const groupTotal = groupOrders.reduce((sum, o) => sum + (o['Grand Total'] || 0), 0);

                doc.autoTable({
                    startY: finalY,
                    head: tableHead,
                    body: tableBody,
                    theme: 'striped',
                    headStyles: {
                        fillColor: [43, 53, 72],
                        textColor: [255, 255, 255],
                        fontSize: 8,
                        ...(fontBase64 ? { font: FONT_NAME } : {}),
                    },
                    styles: {
                        fontSize: 8,
                        cellPadding: 2,
                        overflow: 'linebreak',
                        ...(fontBase64 ? { font: FONT_NAME } : {}),
                    },
                    columnStyles,
                    margin: { top: 20, left: 14, right: 14 },

                    // Draw logos inside body cells
                    didDrawCell: (data: any) => {
                        if (data.section !== 'body') return;
                        const order = groupOrders[data.row.index];
                        if (!order) return;

                        // Phone carrier logo
                        if (data.column.index === colIdx.phone) {
                            const carrier = getCarrierForPhone(order['Customer Phone']);
                            if (carrier) {
                                const logo = carrierLogoCache[carrier.CarrierName];
                                if (logo) drawCellLogo(doc, logo, data.cell.x, data.cell.y, data.cell.height);
                            }
                        }

                        // Shipping service logo
                        if (data.column.index === colIdx.shipping) {
                            const logo = shippingLogoCache[order['Internal Shipping Method']];
                            if (logo) drawCellLogo(doc, logo, data.cell.x, data.cell.y, data.cell.height);
                        }
                    },
                });

                finalY = doc.lastAutoTable.finalY + 2;

                // Group subtotal
                if (grouping !== 'None') {
                    useKhmer();
                    doc.setFontSize(9);
                    doc.setTextColor(70, 70, 70);
                    doc.text(`សរុបក្រុម: $${groupTotal.toFixed(2)}`, pageW - 15, finalY + 4, { align: 'right' });
                    finalY += 11;
                } else {
                    finalY += 4;
                }
            });

            // Grand total (when not grouped)
            if (grouping === 'None') {
                const grandTotal = orders.reduce((sum, o) => sum + (o['Grand Total'] || 0), 0);
                useKhmer();
                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);
                doc.text(`សរុបទឹកប្រាក់: $${grandTotal.toFixed(2)}`, pageW - 15, finalY + 5, { align: 'right' });
            }

            // Page numbers
            const pageCount = doc.internal.pages.length - 1;
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                useKhmer();
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`ទំព័រ ${i} នៃ ${pageCount}`, pageW / 2, doc.internal.pageSize.height - 5, { align: 'center' });
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

    // ── UI ──────────────────────────────────────────────────────────────────

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
                        {(Object.keys(columns) as Array<keyof typeof columns>).map(key => (
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

                {/* Info note */}
                <p className="text-xs text-gray-500 px-1">
                    លេខទូរស័ព្ទត្រូវបាន format ឲ្យចាប់ផ្ដើមដោយ <span className="text-gray-300 font-mono">0</span> ដោយស្វ័យប្រវត្តិ។
                    Logo ក្រុមហ៊ុនដឹក &amp; network carrier នឹងបង្ហាញក្នុង PDF បើអ៊ីនធឺណិតអនុញ្ញាត។
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
