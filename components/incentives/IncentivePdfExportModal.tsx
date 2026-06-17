
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Spinner from '../common/Spinner';
import { translations } from '../../translations';
import { FileText, X, Download, Terminal, Info, Activity } from 'lucide-react';

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
            <div className="bg-[#121212] border border-[#1A1A1A] shadow-2xl rounded overflow-hidden text-[#EAECEF] font-sans">
                <div className="p-8 text-center space-y-8">
                    <div className="relative inline-block">
                        <div className="w-20 h-20 bg-[#050505] rounded border border-[#1A1A1A] flex items-center justify-center mx-auto shadow-inner">
                            <Terminal className="w-10 h-10 text-[#F0B90B]" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#0ECB81]/10 rounded-full flex items-center justify-center border border-[#0ECB81]/30">
                            <Activity className="w-4 h-4 text-[#0ECB81] animate-pulse" />
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-sm font-black text-[#EAECEF] uppercase tracking-[0.3em] mb-2">{t.export || 'Generate_Protocol_Report'}</h3>
                        <p className="text-[10px] text-[#707A8A] font-bold uppercase tracking-widest">Finalizing asset distribution records</p>
                    </div>

                    <div className="bg-[#080808] border border-[#1A1A1A] p-5 rounded space-y-4">
                        <div className="space-y-1.5">
                            <p className="text-[9px] text-[#707A8A] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                <Info className="w-3 h-3" /> Station_Identity
                            </p>
                            <p className="text-xs font-bold text-[#EAECEF] uppercase tracking-[0.1em]">{projectName}</p>
                        </div>
                        <div className="h-px bg-[#1A1A1A] w-1/2 mx-auto"></div>
                        <div className="space-y-1.5">
                            <p className="text-[9px] text-[#707A8A] font-black uppercase tracking-widest">Temporal_Period</p>
                            <p className="text-xs font-mono font-black text-[#F0B90B] uppercase">{selectedMonth}</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <button 
                            onClick={generatePDF}
                            disabled={isGenerating}
                            className="w-full h-12 bg-[#F0B90B] hover:bg-[#D4A50A] text-black rounded font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale active:scale-[0.98]"
                        >
                            {isGenerating ? <Spinner size="sm" /> : <Download className="w-4 h-4 stroke-[3]" />}
                            {isGenerating ? 'Processing_Data...' : 'Download_PDF_Package'}
                        </button>
                        <button 
                            onClick={onClose}
                            className="w-full h-10 bg-[#050505] text-[#707A8A] hover:text-[#EAECEF] rounded font-black uppercase text-[9px] tracking-widest transition-all border border-[#1A1A1A] hover:border-[#2B3139]"
                        >
                            {t.cancel || 'Abort_Operation'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default IncentivePdfExportModal;
