import React, { useState, useContext } from 'react';
import { IncentiveCalculator, CalculatorType } from '../../types';
import { addCalculatorToProject, updateCalculator } from '../../services/incentiveService';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import { Zap, TrendingUp, ChevronRight, ChevronLeft, Save, X, Cpu, Beaker, Layout, Terminal, Rocket, MousePointer2 } from 'lucide-react';

import Step1Templates from './builder/Step1Templates';
import Step2Configuration from './builder/Step2Configuration';
import Step3TargetEntities from './builder/Step3TargetEntities';
import Step4Logic from './builder/Step4Logic';
import Step5Simulation from './builder/Step5Simulation';

interface CalculatorBuilderProps {
    projectId: string;
    initialData?: IncentiveCalculator;
    type: CalculatorType;
    onClose: () => void;
    onSave: () => void;
}

const CalculatorBuilder: React.FC<CalculatorBuilderProps> = ({ projectId, initialData, type, onClose, onSave }) => {
    const { language, appData } = useContext(AppContext);
    const t = translations[language];

    const [step, setStep] = useState(1);
    const [previewInput, setPreviewInput] = useState<number>(5000);
    
    const [calcData, setCalcData] = useState<Partial<IncentiveCalculator>>(initialData || {
        name: '',
        type,
        status: 'Active',
        departmentOrRole: [],
        applyTo: [],
        metricType: 'Sales Amount',
        metricUnit: 'USD',
        calculationPeriod: 'Monthly',
        resetEveryPeriod: true,
        achievementTiers: [],
        commissionType: 'Flat Commission',
        commissionMethod: 'Percentage',
        commissionCondition: 'On Total Sales',
        commissionRate: 0,
        commissionTiers: [],
        distributionRule: { method: 'Equal Split' },
        startDate: '',
        endDate: '',
        targetAmount: 0,
        minSalesRequired: 0,
        maxCommissionCap: 0,
        requireApproval: false,
        excludeRefunded: true,
        includeTax: false
    });

    const updateField = (field: keyof IncentiveCalculator, value: any) => {
        setCalcData(prev => ({ ...prev, [field]: value }));
    };

    const toggleApplyTo = (item: string) => {
        const current = calcData.applyTo || [];
        if (current.includes(item)) {
            updateField('applyTo', current.filter(i => i !== item));
        } else {
            updateField('applyTo', [...current, item]);
        }
    };

    const applyTemplate = (templateId: string) => {
        const updates: Partial<IncentiveCalculator> = {};
        if (templateId === 'tiered_sales') {
            updates.name = 'Tiered Sales Bonus';
            updates.type = 'Achievement';
            updates.calculationPeriod = 'Monthly';
            updates.achievementTiers = [
                { id: 't1', target: 3000, rewardAmount: 20, rewardType: 'Fixed Cash', name: 'Bronze' },
                { id: 't2', target: 6000, rewardAmount: 50, rewardType: 'Fixed Cash', name: 'Silver' },
                { id: 't3', target: 10000, rewardAmount: 100, rewardType: 'Fixed Cash', name: 'Gold' }
            ];
        } else if (templateId === 'weekly_progressive') {
            updates.name = 'Weekly Sprint Incentive';
            updates.type = 'Achievement';
            updates.calculationPeriod = 'Weekly';
            updates.isMarathon = true;
            updates.achievementTiers = [
                { id: 'w1', target: 1500, rewardAmount: 10, rewardType: 'Fixed Cash', subPeriod: 'W1', name: 'Week 1 Goal' },
                { id: 'w2', target: 3000, rewardAmount: 15, rewardType: 'Fixed Cash', subPeriod: 'W2', name: 'Week 2 Goal' },
                { id: 'w3', target: 4500, rewardAmount: 20, rewardType: 'Fixed Cash', subPeriod: 'W3', name: 'Week 3 Goal' },
                { id: 'w4', target: 6000, rewardAmount: 30, rewardType: 'Fixed Cash', subPeriod: 'W4', name: 'Week 4 Goal' }
            ];
        } else if (templateId === 'flat_commission') {
            updates.name = 'Standard 1% Commission';
            updates.type = 'Commission';
            updates.commissionType = 'Flat Commission';
            updates.commissionRate = 1;
            updates.commissionMethod = 'Percentage';
            updates.commissionCondition = 'On Total Sales';
        } else if (templateId === 'above_target') {
            updates.name = 'Above Target Bonus (5%)';
            updates.type = 'Commission';
            updates.commissionType = 'Above Target Commission';
            updates.commissionCondition = 'Above Target';
            updates.targetAmount = 4000;
            updates.commissionRate = 5;
            updates.commissionMethod = 'Percentage';
        }
        
        setCalcData(prev => ({ ...prev, ...updates }));
        setStep(2);
    };

    const handleSave = async () => {
        if (!calcData.name) return alert("Please provide a name.");
        const finalData = { ...calcData, type: calcData.type || type };
        if (initialData?.id) await updateCalculator(projectId, initialData.id, finalData);
        else await addCalculatorToProject(projectId, finalData as Omit<IncentiveCalculator, 'id'>);
        onSave();
    };

    const steps = [
        { id: 1, label: 'TEMPLATE', icon: Layout },
        { id: 2, label: 'CONFIG', icon: Cpu },
        { id: 3, label: 'TARGETS', icon: MousePointer2 },
        { id: 4, label: 'LOGIC', icon: Beaker },
        { id: 5, label: 'SIMULATE', icon: Rocket }
    ];

    return (
        <div className="w-full min-h-screen bg-[#050505] text-[#F5F5F7] font-sans">
            <div className="max-w-5xl mx-auto p-6 sm:p-12 pb-40">
                {/* Global Command Header */}
                <div className="flex justify-between items-center mb-12 bg-white/[0.03] p-6 rounded-[32px] border border-white/10 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
                            type === 'Achievement' ? 'border-primary/30 bg-black text-primary shadow-primary/10' : 'border-emerald-500/30 bg-black text-emerald-400 shadow-emerald-500/10'
                        }`}>
                            {type === 'Achievement' ? <Zap className="w-7 h-7" /> : <TrendingUp className="w-7 h-7" />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase italic tracking-tight leading-none mb-2">{type === 'Achievement' ? 'Achievement Bonus' : 'Commission Engine'}</h2>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Protocol_v2.5_Refined</span>
                                <div className="w-1 h-1 bg-white/10 rounded-full"></div>
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Ready for Deployment</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-black hover:bg-red-500/10 text-white/40 hover:text-red-500 transition-all rounded-xl border border-white/10 group"><X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" /></button>
                </div>

                {/* Cyber Stepper */}
                <div className="mb-16 px-10 relative">
                    <div className="absolute top-1/2 left-10 right-10 h-[2px] bg-white/5 -translate-y-1/2 z-0"></div>
                    <div className="absolute top-1/2 left-10 h-[2px] bg-primary -translate-y-1/2 z-0 transition-all duration-700 ease-out shadow-[0_0_15px_rgba(252,213,53,0.5)]" style={{ width: `calc(${((step - 1) / (steps.length - 1)) * 100}% - 40px)` }}></div>
                    <div className="flex justify-between relative z-10">
                        {steps.map(s => (
                            <div key={s.id} className="flex flex-col items-center gap-4">
                                <button 
                                    onClick={() => s.id < step && setStep(s.id)} 
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all duration-500 border-2 ${
                                        step >= s.id ? 'bg-primary border-primary text-black shadow-[0_0_25px_rgba(252,213,53,0.3)]' : 'bg-[#050505] border-white/10 text-white/20'
                                    }`}
                                >
                                    <s.icon className={`w-5 h-5 ${step >= s.id ? 'stroke-[3]' : 'stroke-[2]'}`} />
                                </button>
                                <span className={`text-[9px] font-black uppercase tracking-[0.3em] transition-all duration-500 ${step >= s.id ? 'text-primary' : 'text-white/10'}`}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Logic Studio Container */}
                <div className="bg-white/[0.02] border border-white/10 rounded-[48px] p-10 sm:p-16 min-h-[550px] relative overflow-hidden shadow-2xl group/studio transition-all hover:bg-white/[0.03]">
                    <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover/studio:opacity-[0.04] transition-opacity">
                        <Terminal className="w-64 h-64" />
                    </div>
                    
                    <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {step === 1 && <Step1Templates calcType={calcData.type || type} calcName={calcData.name || ''} onApplyTemplate={applyTemplate} onNameChange={(val) => updateField('name', val)} />}
                        {step === 2 && <Step2Configuration calcData={calcData} updateField={updateField} />}
                        {step === 3 && <Step3TargetEntities calcData={calcData} appData={appData} updateField={updateField} toggleApplyTo={toggleApplyTo} />}
                        {step === 4 && <Step4Logic calcData={calcData} updateField={updateField} />}
                        {step === 5 && <Step5Simulation calcData={calcData} previewInput={previewInput} setPreviewInput={setPreviewInput} updateField={updateField} />}
                    </div>
                </div>

                {/* Command Bar Footer */}
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
                    <div className="bg-black/80 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl flex justify-between items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <button 
                            disabled={step === 1}
                            onClick={() => setStep(s => s - 1)}
                            className={`h-14 px-8 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center gap-3 ${
                                step === 1 ? 'text-white/10 cursor-not-allowed' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <ChevronLeft className="w-4 h-4 stroke-[3]" /> Previous
                        </button>
                        
                        <div className="flex gap-4">
                            {step < 5 ? (
                                <button 
                                    onClick={() => setStep(s => s + 1)}
                                    className="h-14 px-10 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all border border-white/10 flex items-center gap-3 group"
                                >
                                    Proceed <ChevronRight className="w-4 h-4 stroke-[3] group-hover:translate-x-1 transition-transform" />
                                </button>
                            ) : (
                                <button 
                                    onClick={handleSave}
                                    className="h-14 px-12 bg-primary hover:bg-[#FCD535] text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center gap-3 shadow-[0_0_30px_rgba(252,213,53,0.3)] active:scale-95 group"
                                >
                                    <Save className="w-5 h-5 stroke-[3]" /> Deploy_Protocol
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalculatorBuilder;
