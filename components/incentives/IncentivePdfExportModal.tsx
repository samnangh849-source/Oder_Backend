
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Spinner from '../common/Spinner';
import { translations } from '../../translations';
import { FileText, X, Download } from 'lucide-react';

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
            <div className="ui-binance bg-card-bg border border-[#2B3139] rounded-md overflow-hidden">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-[#2B3139] rounded-md flex items-center justify-center mx-auto mb-6 border border-[#474D57]">
                        <FileText className="w-8 h-8 text-primary" />
                    </div>
                    
                    <h3 className="text-lg font-bold text-[#EAECEF] uppercase tracking-wider mb-2">{t.export || 'Confirm PDF Export'}</h3>
                    <div className="bg-bg-black border border-[#2B3139] p-4 rounded-md mb-8">
                        <p className="text-[11px] text-secondary leading-relaxed uppercase tracking-wider">
                            Generating report for <span className="text-[#EAECEF] font-bold">{projectName}</span>
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="text-[10px] text-secondary font-bold uppercase tracking-widest">Period:</span>
                            <span className="text-primary font-mono text-[11px] font-bold uppercase">{selectedMonth}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={generatePDF}
                            disabled={isGenerating}
                            className="w-full py-3 bg-primary hover:bg-[#f0c51d] text-bg-black rounded-md font-bold uppercase text-[11px] tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isGenerating ? <><Spinner size="sm" /> Processing...</> : <><Download className="w-4 h-4" /> Download PDF Report</>}
                        </button>
                        <button 
                            onClick={onClose}
                            className="w-full py-3 bg-bg-black text-secondary hover:text-[#EAECEF] rounded-md font-bold uppercase text-[11px] tracking-widest transition-all border border-[#2B3139]"
                        >
                            {t.cancel || 'Cancel'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default IncentivePdfExportModal;
