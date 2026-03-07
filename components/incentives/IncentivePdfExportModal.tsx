
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Spinner from '../common/Spinner';
import { translations } from '../../translations';

interface IncentiveResult {
    username: string;
    fullName: string;
    avatar?: string;
    role?: string;
    team?: string;
    performance: number;
    reward: number;
    isCustom: boolean;
    breakdown: { name: string; amount: number }[];
}

interface IncentivePdfExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    results: IncentiveResult[];
    projectName: string;
    selectedMonth: string;
    language: 'en' | 'km';
}

const IncentivePdfExportModal: React.FC<IncentivePdfExportModalProps> = ({ 
    isOpen, 
    onClose, 
    results, 
    projectName, 
    selectedMonth,
    language
}) => {
    const t = translations[language];
    const [isGenerating, setIsGenerating] = useState(false);

    const generatePDF = () => {
        if (isGenerating) return;
        setIsGenerating(true);
        
        setTimeout(() => {
            try {
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                }) as any;

                const pageWidth = doc.internal.pageSize.width;
                
                // --- Header ---
                doc.setFontSize(20);
                doc.setTextColor(40, 40, 40);
                doc.text("Incentive & Bonus Report", pageWidth / 2, 20, { align: 'center' });
                
                doc.setFontSize(14);
                doc.setTextColor(60, 60, 60);
                doc.text(projectName, pageWidth / 2, 28, { align: 'center' });

                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Period: ${selectedMonth}`, 14, 40);
                doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth - 14, 40, { align: 'right' });

                // --- Summary Stats ---
                const totalPayout = results.reduce((sum, r) => sum + r.reward, 0);
                const totalPerf = results.reduce((sum, r) => sum + r.performance, 0);

                doc.setFillColor(245, 247, 250);
                doc.rect(14, 45, pageWidth - 28, 15, 'F');
                doc.setFontSize(11);
                doc.setTextColor(30, 41, 59);
                doc.text(`Total Performance: $${totalPerf.toLocaleString()}`, 20, 54);
                doc.setTextColor(16, 185, 129); // Emerald 500
                doc.text(`Total Payout: $${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - 20, 54, { align: 'right' });

                // --- Table ---
                const tableHead = [["#", "Personnel", "Team / Role", "Performance", "Reward Amount"]];
                const tableBody = results.map((r, idx) => [
                    idx + 1,
                    r.fullName,
                    `${r.team || '-'}\n${r.role || ''}`,
                    `$${r.performance.toLocaleString()}`,
                    `$${r.reward.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                ]);

                doc.autoTable({
                    startY: 65,
                    head: tableHead,
                    body: tableBody,
                    theme: 'grid',
                    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
                    styles: { fontSize: 9, cellPadding: 4 },
                    columnStyles: {
                        0: { cellWidth: 10 },
                        3: { halign: 'right', fontStyle: 'bold' },
                        4: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }
                    },
                });

                let finalY = doc.lastAutoTable.finalY + 30;

                // --- Signatures ---
                if (finalY > doc.internal.pageSize.height - 40) {
                    doc.addPage();
                    finalY = 30;
                }

                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text("Prepared By", 30, finalY);
                doc.text("__________________________", 20, finalY + 15);
                
                doc.text("Approved By", pageWidth - 60, finalY);
                doc.text("__________________________", pageWidth - 70, finalY + 15);

                // --- Footer ---
                const pageCount = doc.internal.pages.length - 1;
                for(let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
                }

                doc.save(`Incentive_Report_${projectName}_${selectedMonth}.pdf`);
                setIsGenerating(false);
                onClose();
            } catch (err) {
                console.error("PDF Generation Error:", err);
                alert("Failed to generate PDF.");
                setIsGenerating(false);
            }
        }, 100);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="p-6 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-xl">
                    <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2 italic">Confirm PDF Export</h3>
                <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                    You are about to generate an official incentive report for <span className="text-white font-bold">{projectName}</span> for the period of <span className="text-indigo-400 font-bold">{selectedMonth}</span>.
                </p>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={generatePDF}
                        disabled={isGenerating}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl shadow-red-900/20 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isGenerating ? <><Spinner size="sm" /> Generating...</> : <>Download PDF Report</>}
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-full py-4 bg-slate-800 text-slate-400 hover:text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default IncentivePdfExportModal;
