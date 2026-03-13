import { IncentiveProject, IncentiveCalculator, IncentiveResult } from '../types';
import { WEB_APP_URL } from '../constants';
import { CacheService, CACHE_KEYS } from './cacheService';

const getAuthHeaders = async () => {
    const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.token || ''}`
    };
};

export const getIncentiveCalculators = async (): Promise<IncentiveCalculator[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/calculators`, { headers });
        const result = await response.json();
        if (result.status === 'success' && Array.isArray(result.data)) {
            return result.data.map((calc: any) => {
                if (calc.rulesJson) {
                    try {
                        const rules = JSON.parse(calc.rulesJson);
                        return { ...calc, ...rules };
                    } catch (e) {
                        console.warn("Failed to parse rulesJson for calc", calc.id);
                    }
                }
                return calc;
            });
        }
        return [];
    } catch (e) {
        console.error("Error loading incentive calculators", e);
        return [];
    }
};

export const createIncentiveCalculator = async (calc: Omit<IncentiveCalculator, 'id'>): Promise<IncentiveCalculator | null> => {
    try {
        const headers = await getAuthHeaders();
        
        // Serialize extra fields into rulesJson for Go backend
        const { name, type, value, rulesJson: _, ...extraFields } = calc as any;
        const serializedCalc = {
            name,
            type,
            value: Number(value) || 0,
            rulesJson: JSON.stringify(extraFields)
        };

        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/calculators`, {
            method: 'POST',
            headers,
            body: JSON.stringify(serializedCalc)
        });
        const result = await response.json();
        return result.status === 'success' ? result.data : null;
    } catch (e) {
        console.error("Error creating incentive calculator", e);
        return null;
    }
};

export const getIncentiveProjects = async (): Promise<IncentiveProject[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/projects`, { headers });
        const result = await response.json();
        return result.status === 'success' ? result.data : [];
    } catch (e) {
        console.error("Error loading incentive projects", e);
        return [];
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
        const result = await response.json();
        return result.status === 'success' ? result.data : null;
    } catch (e) {
        console.error("Error creating incentive project", e);
        return null;
    }
};

export const getIncentiveResults = async (projectId?: number): Promise<IncentiveResult[]> => {
    try {
        const headers = await getAuthHeaders();
        const url = projectId 
            ? `${WEB_APP_URL}/api/admin/incentive/results?projectId=${projectId}`
            : `${WEB_APP_URL}/api/admin/incentive/results`;
        const response = await fetch(url, { headers });
        const result = await response.json();
        return result.status === 'success' ? result.data : [];
    } catch (e) {
        console.error("Error loading incentive results", e);
        return [];
    }
};

export const calculateIncentive = async (projectId: number): Promise<IncentiveResult[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/incentive/calculate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ projectId })
        });
        const result = await response.json();
        return result.status === 'success' ? result.data : [];
    } catch (e) {
        console.error("Error calculating incentive", e);
        return [];
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
        const result = await response.json();
        return result.status === 'success' ? result.data : null;
    } catch (e) { return null; }
};

export const deleteProject = async (id: number): Promise<boolean> => {
    try {
        const headers = await getAuthHeaders();
        await fetch(`${WEB_APP_URL}/api/admin/delete-row`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sheetName: 'IncentiveProjects',
                primaryKey: { id: String(id) }
            })
        });
        return true;
    } catch (e) { return false; }
};

export const addCalculatorToProject = async (projectId: number, calculator: Omit<IncentiveCalculator, 'id'>): Promise<IncentiveCalculator | null> => {
    // This is more complex because it involves linking. 
    // For now, let's just create the calculator. 
    // In Go backend, we'd need an endpoint to link them if they are separate.
    return createIncentiveCalculator(calculator);
};

export const updateCalculator = async (projectId: number, calculatorId: number, updates: Partial<IncentiveCalculator>): Promise<IncentiveCalculator | null> => {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sheetName: 'IncentiveCalculators',
                primaryKey: { id: String(calculatorId) },
                newData: updates
            })
        });
        const result = await response.json();
        return result.status === 'success' ? result.data : null;
    } catch (e) { return null; }
};

export const deleteCalculator = async (projectId: number, calculatorId: number): Promise<boolean> => {
    try {
        const headers = await getAuthHeaders();
        await fetch(`${WEB_APP_URL}/api/admin/delete-row`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sheetName: 'IncentiveCalculators',
                primaryKey: { id: String(calculatorId) }
            })
        });
        return true;
    } catch (e) { return false; }
};

export const duplicateProject = async (id: number): Promise<IncentiveProject | null> => {
    const source = await getProjectById(id);
    if (!source) return null;
    const { id: _, ...rest } = source;
    return createIncentiveProject({ ...rest, projectName: `${source.projectName} (Copy)` });
};

export const duplicateCalculator = async (projectId: number, calculatorId: number): Promise<IncentiveCalculator | null> => {
    // Implementation simplified for now
    return null;
};

export const createProject = async (project: Omit<IncentiveProject, 'id' | 'createdAt' | 'calculators'>): Promise<IncentiveProject | null> => {
    return createIncentiveProject(project as any);
};
