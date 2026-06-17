
import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../common/Modal';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { TeamPage } from '../../types';
import { imageUrlToBase64, convertGoogleDriveUrl } from '../../utils/fileUtils';
import Spinner from '../common/Spinner';
import ExportTemplate from './ExportTemplate';

interface PagesPdfExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    pages: TeamPage[];
}

const PagesPdfExportModal: React.FC<PagesPdfExportModalProps> = ({ isOpen, onClose, pages }) => {
    const [teamsPerRow, setTeamsPerRow] = useState<number>(3); 
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const [columns, setColumns] = useState({
        pageName: true,
        telegramValue: true,
        logoImage: true,
    });

    const [selectedPageNames, setSelectedPageNames] = useState<Set<string>>(new Set());
    const [imageMap, setImageMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen && pages && pages.length > 0 && selectedPageNames.size === 0) {
            setSelectedPageNames(new Set(pages.map(p => p.PageName)));
        }
        if (!isOpen) {
            setPreviewImage(null); // Reset preview on close
        }
    }, [isOpen, pages]);

    const storesHierarchy = useMemo(() => {
        const hierarchy: Record<string, Record<string, TeamPage[]>> = {};
        if (!pages) return hierarchy;

        pages.forEach(p => {
            const store = p.DefaultStore || 'No Store';
            const team = p.Team || 'No Team';
            if (!hierarchy[store]) hierarchy[store] = {};
            if (!hierarchy[store][team]) hierarchy[store][team] = [];
            hierarchy[store][team].push(p);
        });
        return hierarchy;
    }, [pages]);

    const toggleColumn = (key: keyof typeof columns) => {
        setColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const togglePageSelection = (pageName: string) => {
        setSelectedPageNames(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pageName)) newSet.delete(pageName);
            else newSet.add(pageName);
            return newSet;
        });
    };

    const toggleTeamSelection = (teamPages: TeamPage[]) => {
        const allSelected = teamPages.every(p => selectedPageNames.has(p.PageName));
        setSelectedPageNames(prev => {
            const newSet = new Set(prev);
            teamPages.forEach(p => {
                if (allSelected) newSet.delete(p.PageName);
                else newSet.add(p.PageName);
            });
            return newSet;
        });
    };

    const toggleStoreSelection = (storeTeams: Record<string, TeamPage[]>) => {
        const allPagesInStore = Object.values(storeTeams).flat();
        const allSelected = allPagesInStore.every(p => selectedPageNames.has(p.PageName));
        setSelectedPageNames(prev => {
            const newSet = new Set(prev);
            allPagesInStore.forEach(p => {
                if (allSelected) newSet.delete(p.PageName);
                else newSet.add(p.PageName);
            });
            return newSet;
        });
    };

    const handleSelectAll = (select: boolean) => {
        if (select) setSelectedPageNames(new Set(pages.map(p => p.PageName)));
        else setSelectedPageNames(new Set());
    };

    const loadImages = async (targetPages: TeamPage[]) => {
        const newImageMap: Record<string, string> = { ...imageMap };
        let processedCount = 0;
        for (const page of targetPages) {
            if (page.PageLogoURL && !newImageMap[page.PageName]) {
                try {
                    const base64 = await imageUrlToBase64(page.PageLogoURL);
                    if (base64) newImageMap[page.PageName] = `data:image/png;base64,${base64}`;
                } catch (e) {
                    console.warn(`Failed to load logo for ${page.PageName}`);
                }
            }
            processedCount++;
            setProgress(Math.round((processedCount / targetPages.length) * 100));
        }
        setImageMap(newImageMap);
        return newImageMap;
    };

    const handleGeneratePreview = async () => {
        if (selectedPageNames.size === 0) return;

        setIsGenerating(true);
        setProgress(0);

        const container = document.getElementById('png-export-layer');
        if (!container) {
            setIsGenerating(false);
            return;
        }

        const originalStyle = container.getAttribute('style') || '';

        try {
            const finalPages = pages.filter(p => selectedPageNames.has(p.PageName));
            await loadImages(finalPages);

            await document.fonts.ready;

            const TARGET_W = 2560;
            
            // Set styles for capture
            container.style.display = 'flex';
            container.style.width = `${TARGET_W}px`;
            container.style.height = 'auto'; // Allow height to extend
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '-10000px'; // Hide offscreen
            container.style.zIndex = '-100';

            // Wait for DOM
            await new Promise(r => setTimeout(r, 1000));

            // Calculate exact height needed
            const scrollHeight = container.scrollHeight;
            const TARGET_H = Math.max(1440, scrollHeight);

            const canvas = await html2canvas(container, {
                backgroundColor: '#020617',
                scale: 1.5, // Better quality
                useCORS: true,
                logging: false,
                width: TARGET_W,
                height: TARGET_H,
                windowWidth: TARGET_W,
                windowHeight: TARGET_H,
                allowTaint: true,
                imageTimeout: 15000,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('png-export-layer');
                    if (el) {
                        el.style.fontFamily = "'Kantumruy Pro', sans-serif";
                        const allNodes = el.querySelectorAll('*');
                        allNodes.forEach(node => {
                            const htmlNode = node as HTMLElement;
                            htmlNode.style.letterSpacing = 'normal';
                            htmlNode.style.textTransform = 'none';
                            htmlNode.style.fontFamily = "'Kantumruy Pro', sans-serif";
                        });
                    }
                }
            });

            const imgData = canvas.toDataURL('image/png', 0.9);
            setPreviewImage(imgData);

        } catch (err) {
            console.error('Preview Generation Error:', err);
            alert('ការបង្កើត Preview បរាជ័យ។');
        } finally {
            container.setAttribute('style', originalStyle);
            setIsGenerating(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!previewImage) return;
        
        try {
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4' // Default, will adjust
            });

            const imgProps = pdf.getImageProperties(previewImage);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Resize PDF page to match image aspect ratio if necessary
            pdf.deletePage(1);
            pdf.addPage([pdfWidth, pdfHeight]);
            pdf.addImage(previewImage, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            pdf.save(`Organization_Chart_${new Date().getTime()}.pdf`);
            onClose();
        } catch (err) {
            console.error(err);
            alert("Export PDF Error");
        }
    };

    const handleDownloadPNG = () => {
        if (!previewImage) return;
        const link = document.createElement('a');
        link.href = previewImage;
        link.download = `Organization_Chart_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-7xl">
            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-600/20 rounded-2xl flex items-center justify-center border border-red-500/30">
                            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        Premium HD Export
                    </h2>
                </div>
                <button onClick={onClose} className="p-3 bg-gray-800 text-gray-400 hover:text-white rounded-2xl active:scale-95 transition-all">&times;</button>
            </div>

            {/* PREVIEW MODE */}
            {previewImage ? (
                <div className="flex flex-col h-[70vh]">
                    <div className="flex-grow overflow-auto bg-gray-950/50 rounded-3xl border border-white/10 p-4 flex items-center justify-center relative">
                        <img src={previewImage} className="max-w-full h-auto shadow-2xl rounded-lg" alt="Preview" />
                    </div>
                    <div className="mt-6 flex flex-wrap justify-between items-center border-t border-white/5 pt-6 gap-4">
                        <button 
                            onClick={() => setPreviewImage(null)} 
                            className="px-8 py-4 text-sm font-black text-gray-400 hover:text-white uppercase flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                            Back to Settings
                        </button>
                        <div className="flex gap-4">
                            <button 
                                onClick={handleDownloadPNG}
                                className="px-8 py-5 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center gap-4 bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16l4 4m0 0l4-4m-4 4V4" /></svg>
                                Download PNG
                            </button>
                            <button 
                                onClick={handleDownloadPDF}
                                className="px-8 py-5 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center gap-4 bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* SETTINGS MODE */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-[70vh]">
                    <div className="lg:col-span-3 space-y-8 overflow-y-auto pr-4 custom-scrollbar">
                        <div className="bg-black/40 p-6 rounded-[2.5rem] border border-white/5 space-y-8 shadow-inner">
                            <div>
                                <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] block mb-4">Density Control</label>
                                <div className="grid grid-cols-3 gap-2 bg-gray-900/50 p-1.5 rounded-2xl border border-gray-800">
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                        <button key={n} onClick={() => setTeamsPerRow(n)} className={`py-2.5 rounded-xl text-xs font-black transition-all ${teamsPerRow === n ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>{n}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] block mb-4">Display Fields</label>
                                <div className="space-y-2">
                                    {(Object.keys(columns) as Array<keyof typeof columns>).map((key) => (
                                        <label key={key} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-2xl border border-gray-800 cursor-pointer hover:bg-blue-600/5 transition-colors group">
                                            {/* Fix: cast key to string to avoid TypeScript error on replace() when keyof is used */}
                                            <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200 capitalize">{(key as string).replace(/([A-Z])/g, ' $1')}</span>
                                            <div className="relative">
                                                <input type="checkbox" checked={columns[key]} onChange={() => toggleColumn(key)} className="sr-only peer" />
                                                <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-9 flex flex-col bg-gray-950/40 rounded-[3rem] border border-white/5 overflow-hidden">
                        <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <p className="text-xs font-black text-white uppercase tracking-widest">{selectedPageNames.size} Nodes Linked</p>
                            </div>
                            <div className="flex gap-6">
                                <button onClick={() => handleSelectAll(true)} className="text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest">Select All</button>
                                <button onClick={() => handleSelectAll(false)} className="text-[10px] font-black text-gray-500 hover:text-white transition-colors uppercase tracking-widest">Clear</button>
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-8 space-y-12 custom-scrollbar">
                            {Object.entries(storesHierarchy).map(([storeName, teams]) => (
                                <div key={storeName} className="space-y-6">
                                    <div className="flex items-center gap-4 group">
                                        {/* Fix: cast teams to avoid 'unknown' type error from Object.entries result in some versions */}
                                        <input type="checkbox" onChange={() => toggleStoreSelection(teams as Record<string, TeamPage[]>)} className="w-6 h-6 rounded-lg border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500/20 cursor-pointer" />
                                        <h4 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-4 group-hover:text-blue-400 transition-colors">
                                            <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                                            {storeName}
                                        </h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pl-10">
                                        {Object.entries(teams).map(([teamName, teamPages]) => {
                                            const isTeamAllSelected = teamPages.every(p => selectedPageNames.has(p.PageName));
                                            return (
                                                <div key={teamName} className="bg-gray-900/40 rounded-3xl border border-white/5 p-6 shadow-xl">
                                                    <label className="flex items-center gap-3 mb-6 cursor-pointer border-b border-white/5 pb-4">
                                                        <input type="checkbox" checked={isTeamAllSelected} onChange={() => toggleTeamSelection(teamPages)} className="w-5 h-5 rounded-md border-gray-700 bg-gray-800 text-blue-500" />
                                                        <span className="text-xs font-black text-gray-400 uppercase tracking-[0.15em]">{teamName}</span>
                                                    </label>
                                                    <div className="space-y-3">
                                                        {teamPages.map(page => (
                                                            <label key={page.PageName} className={`flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${selectedPageNames.has(page.PageName) ? 'bg-blue-600/10 border-blue-500/30' : 'bg-black/20 border-transparent hover:bg-white/5'}`}>
                                                                <input type="checkbox" checked={selectedPageNames.has(page.PageName)} onChange={() => togglePageSelection(page.PageName)} className="w-4 h-4 rounded-md border-gray-700 bg-gray-900 text-blue-600" />
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <img src={convertGoogleDriveUrl(page.PageLogoURL)} className="w-7 h-7 rounded-full object-cover border border-white/10" alt="" />
                                                                    <span className="text-xs font-bold text-gray-300 truncate">{page.PageName}</span>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 border-t border-white/5 bg-gray-900/80 backdrop-blur-xl flex justify-between items-center">
                            <div className="flex flex-col">
                                {isGenerating && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <Spinner size="sm" />
                                            <p className="text-xs font-black text-red-400 uppercase tracking-[0.2em] animate-pulse">Processing Preview: {progress}%</p>
                                        </div>
                                        <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={onClose} className="px-8 py-4 text-sm font-black text-gray-500 hover:text-white uppercase">Cancel</button>
                                <button 
                                    onClick={handleGeneratePreview}
                                    disabled={isGenerating || selectedPageNames.size === 0}
                                    className={`px-12 py-5 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center gap-4 ${isGenerating || selectedPageNames.size === 0 ? 'bg-gray-800 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'}`}
                                >
                                    {isGenerating ? 'Rendering...' : 'Preview Export'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ExportTemplate 
                storesHierarchy={storesHierarchy}
                selectedPageNames={selectedPageNames}
                teamsPerRow={teamsPerRow}
                columns={columns}
                imageMap={imageMap}
            />
        </Modal>
    );
};

export default PagesPdfExportModal;
