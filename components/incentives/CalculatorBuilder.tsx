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
    projectId: string | number;
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
    const [isSaving, setIsSaving] = useState(false);
    
    const [calcData, setCalcData] = useState<Partial<IncentiveCalculator>>(initialData || {
        name: '',
        type,
        status: 'Active',
        departmentOrRole: [],
        applyTo: [],
        excludeTargets: [],
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

    const toggleExcludeTarget = (item: string) => {
        const current = calcData.excludeTargets || [];
        if (current.includes(item)) {
            updateField('excludeTargets', current.filter(i => i !== item));
        } else {
            updateField('excludeTargets', [...current, item]);
        }
    };

    const applyTemplate = (templateId: string) => {
        const updates: Partial<IncentiveCalculator> = {};
        if (templateId === 'marathon_sale') {
            updates.name = 'Marathon Sale Incentives for Team';
            updates.type = 'Achievement';
            updates.calculationPeriod = 'Monthly';
            updates.isMarathon = true;
            updates.achievementTiers = [
                { id: 'w1_t1', target: 1200, rewardAmount: 30, rewardType: 'Fixed Cash', subPeriod: 'W1', name: 'សប្តាហ៍ទី ១ - គោលដៅ ១' },
                { id: 'w1_t2', target: 1400, rewardAmount: 60, rewardType: 'Fixed Cash', subPeriod: 'W1', name: 'សប្តាហ៍ទី ១ - គោលដៅ ២' },
                { id: 'w2_t1', target: 2400, rewardAmount: 30, rewardType: 'Fixed Cash', subPeriod: 'W2', name: 'សប្តាហ៍ទី ២ - គោលដៅ ១' },
                { id: 'w2_t2', target: 2800, rewardAmount: 60, rewardType: 'Fixed Cash', subPeriod: 'W2', name: 'សប្តាហ៍ទី ២ - គោលដៅ ២' },
                { id: 'w3_t1', target: 3600, rewardAmount: 30, rewardType: 'Fixed Cash', subPeriod: 'W3', name: 'សប្តាហ៍ទី ៣ - គោលដៅ ១' },
                { id: 'w3_t2', target: 4200, rewardAmount: 60, rewardType: 'Fixed Cash', subPeriod: 'W3', name: 'សប្តាហ៍ទី ៣ - គោលដៅ ២' },
                { id: 'w4_t1', target: 4800, rewardAmount: 30, rewardType: 'Fixed Cash', subPeriod: 'W4', name: 'សប្តាហ៍ទី ៤ - គោលដៅ ១' },
                { id: 'w4_t2', target: 5600, rewardAmount: 60, rewardType: 'Fixed Cash', subPeriod: 'W4', name: 'សប្តាហ៍ទី ៤ - គោលដៅ ២' }
            ];
        }
 else if (templateId === 'tiered_sales') {
            updates.name = 'Tiered Sales Bonus';
            updates.type = 'Achievement';
            updates.calculationPeriod = 'Monthly';
            updates.achievementTiers = [
                { id: 't1', target: 3000, rewardAmount: 20, rewardType: 'Fixed Cash', name: 'Bronze' },
                { id: 't2', target: 6000, rewardAmount: 50, rewardType: 'Fixed Cash', name: 'Silver' },
                { id: 't3', target: 10000, rewardAmount: 100, rewardType: 'Fixed Cash', name: 'Gold' }
            ];
        } else if (templateId === 'above_4000_commission') {
            updates.name = '5% Commission (> $4000)';
            updates.type = 'Commission';
            updates.commissionType = 'Above Target Commission';
            updates.commissionCondition = 'Above Target';
            updates.targetAmount = 4000;
            updates.commissionRate = 5;
            updates.commissionMethod = 'Percentage';
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
        if (isSaving) return;
        setIsSaving(true);
        try {
            const finalData = { ...calcData, type: calcData.type || type };
            const saved = initialData?.id
                ? await updateCalculator(Number(projectId), initialData.id, finalData)
                : await addCalculatorToProject(Number(projectId), finalData as Omit<IncentiveCalculator, 'id'>);
            if (!saved) throw new Error('Calculator save failed.');
            onSave();
        } catch (error: any) {
            alert(error?.message || 'Failed to save calculator.');
        } finally {
            setIsSaving(false);
        }
    };

    const steps = [
        { id: 1, label: 'TEMPLATE', icon: Layout },
        { id: 2, label: 'CONFIG', icon: Cpu },
        { id: 3, label: 'TARGETS', icon: MousePointer2 },
        { id: 4, label: 'LOGIC', icon: Beaker },
        { id: 5, label: 'SIMULATE', icon: Rocket }
    ];

    return (
        <div className="incentive-surface w-full h-screen bg-[#08090a] text-[#EAECEF] font-sans flex flex-col overflow-hidden relative">
            {/* Background Grid Pattern (Packaging Aesthetic) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(252,213,53,0.03)_0%,_transparent_50%)] pointer-events-none z-0"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,_transparent_1px),_linear-gradient(90deg,rgba(255,255,255,0.02)_1px,_transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0 opacity-20"></div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar w-full relative z-10">
                <div className="max-w-5xl mx-auto p-6 sm:p-12 pb-12">
                    {/* Global Command Header */}
                <div className="flex justify-between items-center mb-12 bg-[#0B0E11] p-6 sm:p-8 rounded-sm border border-[#2B3139] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group/header z-10">
                    {/* Background Accent */}
                    <div className={`absolute -top-32 -left-32 w-64 h-64 rounded-full blur-[100px] opacity-10 transition-all duration-700 pointer-events-none ${
                        type === 'Achievement' ? 'bg-[#FCD535] group-hover/header:opacity-20' : 'bg-[#0ECB81] group-hover/header:opacity-20'
                    }`}></div>

                    <div className="flex items-center gap-6 sm:gap-8 relative z-10">
                        <div className={`w-16 h-16 rounded-none flex items-center justify-center border transition-all duration-500 ${
                            type === 'Achievement' 
                                ? 'border-[#FCD535]/30 bg-[#FCD535]/10 text-[#FCD535] shadow-[0_0_20px_rgba(252,213,53,0.15)] group-hover/header:border-[#FCD535]/50 group-hover/header:shadow-[0_0_30px_rgba(252,213,53,0.25)]' 
                                : 'border-[#0ECB81]/30 bg-[#0ECB81]/10 text-[#0ECB81] shadow-[0_0_20px_rgba(14,203,129,0.15)] group-hover/header:border-[#0ECB81]/50 group-hover/header:shadow-[0_0_30px_rgba(14,203,129,0.25)]'
                        }`}>
                            {type === 'Achievement' ? <Zap className="w-8 h-8 stroke-[2.5]" /> : <TrendingUp className="w-8 h-8 stroke-[2.5]" />}
                        </div>
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black text-[#EAECEF] uppercase tracking-tighter leading-none mb-3 drop-shadow-md">
                                {type === 'Achievement' ? 'Achievement Bonus' : 'Commission Engine'}
                            </h2>
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                                <div className="flex items-center gap-2 px-3 py-1 bg-[#181A20] rounded-sm border border-[#2B3139]">
                                    <div className="w-1.5 h-1.5 bg-[#848E9C] rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.3em]">Protocol_v2.5_Refined</span>
                                </div>
                                <div className="h-4 w-px bg-[#2B3139]"></div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full animate-ping opacity-75 ${type === 'Achievement' ? 'bg-[#FCD535]' : 'bg-[#0ECB81]'}`}></div>
                                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${type === 'Achievement' ? 'text-[#FCD535]' : 'text-[#0ECB81]'}`}>
                                        Ready for Deployment
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-[#181A20] hover:bg-[#F6465D]/10 text-[#848E9C] hover:text-[#F6465D] transition-all duration-300 rounded-sm border border-[#2B3139] group shadow-lg hover:border-[#F6465D]/30 relative z-10 shrink-0"
                    >
                        <X className="w-6 h-6 sm:w-7 sm:h-7 group-hover:rotate-90 transition-transform duration-500" />
                    </button>
                </div>

                {/* Cyber Stepper */}
                <div className="mb-12 sm:mb-16 px-4 sm:px-10 relative z-10">
                    <div className="absolute top-1/2 left-4 sm:left-10 right-4 sm:right-10 h-px bg-[#2B3139] -translate-y-1/2 z-0"></div>
                    <div className={`absolute top-1/2 left-4 sm:left-10 h-[2px] -translate-y-1/2 z-0 transition-all duration-700 ease-out ${type === 'Achievement' ? 'bg-[#FCD535] shadow-[0_0_15px_rgba(252,213,53,0.5)]' : 'bg-[#0ECB81] shadow-[0_0_15px_rgba(14,203,129,0.5)]'}`} style={{ width: `calc(${((step - 1) / (steps.length - 1)) * 100}% - ${window.innerWidth < 640 ? '16px' : '40px'})` }}></div>
                    <div className="flex justify-between relative z-10">
                        {steps.map(s => (
                            <div key={s.id} className="flex flex-col items-center gap-3 sm:gap-4 relative group">
                                <button 
                                    onClick={() => s.id < step && setStep(s.id)} 
                                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-sm flex items-center justify-center text-sm font-black transition-all duration-500 border ${
                                        step >= s.id 
                                            ? (type === 'Achievement' ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-[0_0_20px_rgba(252,213,53,0.3)]' : 'bg-[#0ECB81] border-[#0ECB81] text-black shadow-[0_0_20px_rgba(14,203,129,0.3)]')
                                            : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C]'
                                    } ${s.id < step ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                                >
                                    <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${step >= s.id ? 'stroke-[3]' : 'stroke-[2]'}`} />
                                </button>
                                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest sm:tracking-[0.3em] transition-all duration-500 absolute -bottom-6 sm:-bottom-8 whitespace-nowrap ${step >= s.id ? (type === 'Achievement' ? 'text-[#FCD535]' : 'text-[#0ECB81]') : 'text-[#848E9C]'}`}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Logic Studio Container */}
                <div className="bg-[#0B0E11] border border-[#2B3139] rounded-sm p-6 sm:p-10 lg:p-16 min-h-[550px] relative overflow-hidden shadow-2xl z-10">
                    <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none">
                        <Terminal className="w-64 h-64 text-white" />
                    </div>
                    
                    <div className="relative z-10 animate-in fade-in zoom-in-95 duration-700">
                        {step === 1 && <Step1Templates calcType={calcData.type || type} calcName={calcData.name || ''} onApplyTemplate={applyTemplate} onNameChange={(val) => updateField('name', val)} />}
                        {step === 2 && <Step2Configuration calcData={calcData} updateField={updateField} />}
                        {step === 3 && <Step3TargetEntities calcData={calcData} appData={appData} updateField={updateField} toggleApplyTo={toggleApplyTo} toggleExcludeTarget={toggleExcludeTarget} />}
                        {step === 4 && <Step4Logic calcData={calcData} updateField={updateField} />}
                        {step === 5 && <Step5Simulation calcData={calcData} previewInput={previewInput} setPreviewInput={setPreviewInput} updateField={updateField} />}
                    </div>
                </div>
            </div>

            {/* Command Bar Footer (Sticky relative to the flex container) */}
            <div className="w-full z-50 bg-[#0B0E11] border-t border-[#2B3139] shadow-[0_-10px_40px_rgba(0,0,0,0.6)] shrink-0 relative">
                <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <button 
                        disabled={step === 1}
                            onClick={() => setStep(s => s - 1)}
                            className={`h-12 px-6 rounded-sm font-black uppercase tracking-[0.2em] text-[10px] sm:text-xs transition-all flex items-center justify-center gap-3 w-full sm:w-auto ${
                                step === 1 ? 'text-[#848E9C] opacity-50 cursor-not-allowed bg-[#181A20]' : 'bg-[#181A20] text-[#EAECEF] hover:bg-[#2B3139] border border-[#2B3139] hover:border-[#474D57]'
                            }`}
                        >
                            <ChevronLeft className="w-4 h-4 stroke-[3]" /> Previous
                        </button>
                        
                        <div className="flex gap-4 w-full sm:w-auto">
                            {step < 5 ? (
                                <button 
                                    onClick={() => setStep(s => s + 1)}
                                    className="h-12 flex-1 sm:flex-none px-10 bg-[#2B3139] hover:bg-[#474D57] text-[#EAECEF] rounded-sm font-black uppercase tracking-[0.2em] text-[10px] sm:text-xs transition-all border border-transparent flex items-center justify-center gap-3 group"
                                >
                                    Proceed <ChevronRight className="w-4 h-4 stroke-[3] group-hover:translate-x-1 transition-transform" />
                                </button>
                            ) : (
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`h-12 flex-1 sm:flex-none px-10 disabled:opacity-50 text-black rounded-sm font-black uppercase tracking-[0.2em] text-[10px] sm:text-xs transition-all flex items-center justify-center gap-3 active:scale-95 group ${
                                        type === 'Achievement' 
                                            ? 'bg-[#FCD535] hover:bg-[#FCD535]/90 shadow-[0_0_20px_rgba(252,213,53,0.2)]' 
                                            : 'bg-[#0ECB81] hover:bg-[#0CA66B] shadow-[0_0_20px_rgba(14,203,129,0.2)]'
                                    }`}
                                >
                                    <Save className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" /> {isSaving ? 'Saving...' : 'Deploy_Protocol'}
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
