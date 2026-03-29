import React, { useState, useContext } from 'react';
import { IncentiveCalculator, CalculatorType } from '../../types';
import { addCalculatorToProject, updateCalculator } from '../../services/incentiveService';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import { Zap, TrendingUp, ChevronRight, ChevronLeft, Save, X } from 'lucide-react';

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

    return (
        <div className="ui-binance w-full min-h-screen bg-bg-black text-[#EAECEF] font-sans">
            <div className="max-w-4xl mx-auto p-4 sm:p-8 pb-32">
                {/* Header */}
                <div className="flex justify-between items-center mb-8 bg-card-bg p-4 rounded-md border border-[#2B3139]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-bg-black border border-[#2B3139] text-primary">
                            {type === 'Achievement' ? <Zap className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#EAECEF] uppercase tracking-wider">{type === 'Achievement' ? 'Achievement Bonus' : 'Commission Engine'}</h2>
                            <p className="text-[9px] text-secondary font-bold uppercase tracking-widest">v2.5 Refactored Engine</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-secondary hover:text-[#EAECEF] transition-colors p-2 bg-bg-black rounded-md border border-[#2B3139]"><X className="w-5 h-5" /></button>
                </div>

                {/* Stepper */}
                <div className="flex justify-between mb-10 px-4 relative">
                    <div className="absolute top-4 left-4 right-4 h-px bg-[#2B3139] z-0"></div>
                    <div className="absolute top-4 left-4 h-px bg-primary z-0 transition-all duration-300" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
                    {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} onClick={() => s < step && setStep(s)} className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold z-10 border transition-all ${step >= s ? 'bg-primary border-primary text-bg-black' : 'bg-bg-black border-[#2B3139] text-secondary'}`}>{s}</button>
                    ))}
                </div>

                {/* Content Container */}
                <div className="bg-card-bg border border-[#2B3139] rounded-md p-6 sm:p-8 min-h-[450px]">
                    {step === 1 && <Step1Templates calcType={calcData.type || type} calcName={calcData.name || ''} onApplyTemplate={applyTemplate} onNameChange={(val) => updateField('name', val)} />}
                    {step === 2 && <Step2Configuration calcData={calcData} updateField={updateField} />}
                    {step === 3 && <Step3TargetEntities calcData={calcData} appData={appData} updateField={updateField} toggleApplyTo={toggleApplyTo} />}
                    {step === 4 && <Step4Logic calcData={calcData} updateField={updateField} />}
                    {step === 5 && <Step5Simulation calcData={calcData} previewInput={previewInput} setPreviewInput={setPreviewInput} updateField={updateField} />}
                </div>

                {/* Navigation Footer */}
                <div className="fixed bottom-0 left-0 right-0 bg-[#1E2329] border-t border-[#2B3139] p-4 z-40">
                    <div className="max-w-4xl mx-auto flex justify-between items-center">
                        <button 
                            disabled={step === 1}
                            onClick={() => setStep(s => s - 1)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded font-bold uppercase tracking-widest text-[11px] transition-all ${step === 1 ? 'text-[#474D57] cursor-not-allowed' : 'text-secondary hover:text-[#EAECEF] bg-[#2B3139]'}`}
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        
                        <div className="flex gap-3">
                            {step < 5 ? (
                                <button 
                                    onClick={() => setStep(s => s + 1)}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-[#474D57] hover:bg-[#525963] text-[#EAECEF] rounded font-bold uppercase tracking-widest text-[11px] transition-all"
                                >
                                    Next <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button 
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-10 py-2.5 bg-primary hover:bg-[#f0c51d] text-bg-black rounded font-bold uppercase tracking-widest text-[11px] transition-all shadow-lg shadow-primary/10"
                                >
                                    <Save className="w-4 h-4" /> Finalize & Save
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
