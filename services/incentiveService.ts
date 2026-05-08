import { IncentiveProject, IncentiveCalculator, IncentiveResult } from '../types';
import { WEB_APP_URL } from '../constants';
import { CacheService, CACHE_KEYS } from './cacheService';

type ApiResult<T = any> = {
    status?: 'success' | 'error';
    data?: T;
    message?: string;
};

const getAuthHeaders = async () => {
    const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.token || ''}`
    };
};

const readApiResult = async <T = any>(response: Response): Promise<ApiResult<T>> => {
    let result: ApiResult<T> = {};
    try {
        result = await response.json();
    } catch (error) {
        throw new Error(response.ok ? 'Invalid JSON response from server' : `Server returned ${response.status}`);
    }

    if (!response.ok || result.status === 'error') {
        throw new Error(result.message || `Server returned ${response.status}`);
    }

    return result;
};

const inflateCalculatorRules = (calc: any): IncentiveCalculator => {
    if (calc?.rulesJson) {
        try {
            const rules = JSON.parse(calc.rulesJson);
            return { ...calc, ...rules };
        } catch (e) {
            console.warn("Failed to parse rulesJson for calc", calc.id);
        }
    }
    return calc;
};

const serializeCalculator = (calc: Partial<IncentiveCalculator> & { projectId?: number }) => {
    const { name, type, value, projectId, rulesJson: _, ...extraFields } = calc as any;
    return {
        name,
        type,
        value: Number(value) || 0,
        projectId: Number(projectId) || 0,
        status: extraFields.status || 'Active',
        rulesJson: JSON.stringify(extraFields)
    };
};

export const getIncentiveCalculators = async (): Promise<IncentiveCalculator[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/calculators`, { headers });
        const result = await readApiResult<any[]>(response);
        if (result.status === 'success' && Array.isArray(result.data)) {
            return result.data.map(inflateCalculatorRules);
        }
        return [];
    } catch (e) {
        console.error("Error loading incentive calculators", e);
        throw e;
    }
};

export const createIncentiveCalculator = async (calc: Omit<IncentiveCalculator, 'id'> & { projectId?: number }): Promise<IncentiveCalculator | null> => {
    try {
        const headers = await getAuthHeaders();
        const serializedCalc = serializeCalculator(calc);

        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/calculators`, {
            method: 'POST',
            headers,
            body: JSON.stringify(serializedCalc)
        });
        const result = await readApiResult<IncentiveCalculator>(response);
        return result.status === 'success' && result.data ? inflateCalculatorRules(result.data) : null;
    } catch (e) {
        console.error("Error creating incentive calculator", e);
        throw e;
    }
};

export const getIncentiveProjects = async (): Promise<IncentiveProject[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/projects`, { headers });
        const result = await readApiResult<any[]>(response);
        if (result.status === 'success' && Array.isArray(result.data)) {
            return result.data.map((p: any) => ({
                ...p,
                calculators: (p.calculators || []).map(inflateCalculatorRules)
            }));
        }
        return [];
    } catch (e) {
        console.error("Error loading incentive projects", e);
        throw e;
    }
};

export const createIncentiveProject = async (project: Omit<IncentiveProject, 'id'>): Promise<IncentiveProject | null> => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/projects`, {
            method: 'POST',
            headers,
            body: JSON.stringify(project)
        });
        const result = await readApiResult<IncentiveProject>(response);
        return result.status === 'success' ? result.data : null;
    } catch (e) {
        console.error("Error creating incentive project", e);
        throw e;
    }
};

export const getIncentiveResults = async (projectId?: number): Promise<IncentiveResult[]> => {
    try {
        const headers = await getAuthHeaders();
        const url = projectId 
            ? `${WEB_APP_URL}/api/admin/incentive/results?projectId=${projectId}`
            : `${WEB_APP_URL}/api/admin/incentive/results`;
        const response = await fetch(url, { headers });
        const result = await readApiResult<IncentiveResult[]>(response);
        return result.status === 'success' ? result.data : [];
    } catch (e) {
        console.error("Error loading incentive results", e);
        throw e;
    }
};

export const calculateIncentive = async (projectId: number, month: string): Promise<IncentiveResult[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/calculate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ projectId, month })
        });
        const result = await readApiResult<IncentiveResult[]>(response);
        return result.status === 'success' ? result.data : [];
    } catch (e) {
        console.error("Error calculating incentive", e);
        throw e;
    }
};

export const getIncentiveManualData = async (projectId: number, month: string) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/manual-data?projectId=${projectId}&month=${month}`, { headers });
        const result = await readApiResult(response);
        return result.status === 'success' ? result.data : [];
    } catch (e) {
        console.error("Error loading incentive manual data", e);
        throw e;
    }
};

export const saveIncentiveManualData = async (data: Omit<any, 'id'>) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/manual-data`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        const result = await readApiResult(response);
        return result.status === 'success';
    } catch (e) {
        console.error("Error saving incentive manual data", e);
        return false;
    }
};

export const getIncentiveCustomPayouts = async (projectId: number, month: string) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/custom-payout?projectId=${projectId}&month=${month}`, { headers });
        const result = await readApiResult(response);
        return result.status === 'success' ? result.data : [];
    } catch (e) {
        console.error("Error loading incentive custom payouts", e);
        throw e;
    }
};

export const saveIncentiveCustomPayout = async (data: Omit<any, 'id'>) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/custom-payout`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        const result = await readApiResult(response);
        return result.status === 'success';
    } catch (e) {
        console.error("Error saving incentive custom payout", e);
        return false;
    }
};

export const lockIncentivePayout = async (projectId: number, month: string, results: IncentiveResult[]) => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/lock`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ projectId, month, results })
        });
        const result = await readApiResult(response);
        return result.status === 'success';
    } catch (e) {
        console.error("Error locking incentive payout", e);
        return false;
    }
};

// --- Restored for backward compatibility with UI components ---

export const getProjectById = async (id: number): Promise<IncentiveProject | null> => {
    const projects = await getIncentiveProjects();
    return projects.find(p => p.id === id) || null;
};

export const updateProject = async (id: number, updates: Partial<IncentiveProject>): Promise<IncentiveProject | null> => {
    // In Go backend, we can use update-sheet for this
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sheetName: 'IncentiveProjects', // Assuming this table exists in Go
                primaryKey: { id: String(id) },
                newData: updates
            })
        });
        const result = await readApiResult<IncentiveProject>(response);
        return result.status === 'success' ? result.data || ({ id, ...updates } as IncentiveProject) : null;
    } catch (e) { return null; }
};

export const deleteProject = async (id: number): Promise<boolean> => {
    try {
        const source = await getProjectById(id);
        if (source?.calculators?.length) {
            await Promise.all(source.calculators.map(calc => calc.id ? deleteCalculator(id, calc.id) : Promise.resolve(true)));
        }

        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/delete-row`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sheetName: 'IncentiveProjects',
                primaryKey: { id: String(id) }
            })
        });
        await readApiResult(response);
        return true;
    } catch (e) { return false; }
};

export const addCalculatorToProject = async (projectId: number, calculator: Omit<IncentiveCalculator, 'id'>): Promise<IncentiveCalculator | null> => {
    return createIncentiveCalculator({ ...calculator, projectId });
};

export const updateCalculator = async (projectId: number, calculatorId: number, updates: Partial<IncentiveCalculator>): Promise<IncentiveCalculator | null> => {
    try {
        const headers = await getAuthHeaders();
        
        // Split updates into core fields and extra fields
        const { name, type, value, projectId: _, rulesJson, ...extraFields } = updates as any;
        
        const newData: any = {};
        if (name !== undefined) newData.name = name;
        if (type !== undefined) newData.type = type;
        if (value !== undefined) newData.value = Number(value);
        if (extraFields.status !== undefined) newData.status = extraFields.status;
        
        // Handle extra fields by putting them in rulesJson
        if (Object.keys(extraFields).length > 0) {
            newData.rulesJson = JSON.stringify(extraFields);
        } else if (rulesJson !== undefined) {
            newData.rulesJson = rulesJson;
        }

        const response = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sheetName: 'IncentiveCalculators',
                primaryKey: { id: String(calculatorId) },
                newData
            })
        });
        const result = await readApiResult<IncentiveCalculator>(response);
        return result.status === 'success' ? result.data || ({ id: calculatorId, projectId, ...updates } as IncentiveCalculator) : null;
    } catch (e) { return null; }
};

export const deleteCalculator = async (projectId: number, calculatorId: number): Promise<boolean> => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/delete-row`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sheetName: 'IncentiveCalculators',
                primaryKey: { id: String(calculatorId) }
            })
        });
        await readApiResult(response);
        return true;
    } catch (e) { return false; }
};

export const duplicateProject = async (id: number): Promise<IncentiveProject | null> => {
    const source = await getProjectById(id);
    if (!source) return null;
    const { id: _, calculators, createdAt, ...rest } = source;
    const copy = await createIncentiveProject({ ...rest, projectName: `${source.projectName} (Copy)`, status: 'Draft' });
    if (!copy?.id || !calculators?.length) return copy;

    await Promise.all(calculators.map(calc => {
        const { id: __, projectId: ___, ...calcRest } = calc as any;
        return createIncentiveCalculator({ ...calcRest, projectId: copy.id });
    }));

    return getProjectById(copy.id);
};

export const duplicateCalculator = async (projectId: number, calculatorId: number): Promise<IncentiveCalculator | null> => {
    const sourceProject = await getProjectById(projectId);
    const source = sourceProject?.calculators?.find(calc => calc.id === calculatorId);
    if (!source) return null;

    const { id: _, projectId: __, ...copy } = source as any;
    return createIncentiveCalculator({
        ...copy,
        projectId,
        name: `${source.name} (Copy)`,
        status: 'Draft'
    });
};

export const createProject = async (project: Omit<IncentiveProject, 'id' | 'createdAt' | 'calculators'>): Promise<IncentiveProject | null> => {
    return createIncentiveProject(project as any);
};
