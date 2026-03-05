import { IncentiveProject, IncentiveCalculator } from '../types';

const STORAGE_KEY = 'incentive_projects';

export const getIncentiveProjects = (): IncentiveProject[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Error loading incentive projects", e);
        return [];
    }
};

export const saveIncentiveProjects = (projects: IncentiveProject[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
        console.error("Error saving incentive projects", e);
    }
};

export const getProjectById = (id: string): IncentiveProject | undefined => {
    return getIncentiveProjects().find(p => p.id === id);
};

export const createProject = (project: Omit<IncentiveProject, 'id' | 'createdAt' | 'calculators'>): IncentiveProject => {
    const projects = getIncentiveProjects();
    const newProject: IncentiveProject = {
        ...project,
        id: `proj_${Date.now()}`,
        createdAt: new Date().toISOString(),
        calculators: []
    };
    projects.push(newProject);
    saveIncentiveProjects(projects);
    return newProject;
};

export const updateProject = (id: string, updates: Partial<IncentiveProject>): IncentiveProject | null => {
    const projects = getIncentiveProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) return null;

    projects[index] = { ...projects[index], ...updates };
    saveIncentiveProjects(projects);
    return projects[index];
};

export const deleteProject = (id: string): boolean => {
    const projects = getIncentiveProjects();
    const initialLength = projects.length;
    const filteredProjects = projects.filter(p => p.id !== id);
    
    if (filteredProjects.length !== initialLength) {
        saveIncentiveProjects(filteredProjects);
        return true;
    }
    return false;
};

export const addCalculatorToProject = (projectId: string, calculator: Omit<IncentiveCalculator, 'id'>): IncentiveCalculator | null => {
    const projects = getIncentiveProjects();
    const index = projects.findIndex(p => p.id === projectId);
    if (index === -1) return null;

    const newCalculator: IncentiveCalculator = {
        ...calculator,
        id: `calc_${Date.now()}`
    };

    projects[index].calculators.push(newCalculator);
    saveIncentiveProjects(projects);
    return newCalculator;
};

export const updateCalculator = (projectId: string, calculatorId: string, updates: Partial<IncentiveCalculator>): IncentiveCalculator | null => {
    const projects = getIncentiveProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) return null;

    const calcIndex = projects[projectIndex].calculators.findIndex(c => c.id === calculatorId);
    if (calcIndex === -1) return null;

    projects[projectIndex].calculators[calcIndex] = { ...projects[projectIndex].calculators[calcIndex], ...updates };
    saveIncentiveProjects(projects);
    return projects[projectIndex].calculators[calcIndex];
};

export const deleteCalculator = (projectId: string, calculatorId: string): boolean => {
    const projects = getIncentiveProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) return false;

    const initialLength = projects[projectIndex].calculators.length;
    projects[projectIndex].calculators = projects[projectIndex].calculators.filter(c => c.id !== calculatorId);
    
    if (projects[projectIndex].calculators.length !== initialLength) {
        saveIncentiveProjects(projects);
        return true;
    }
    return false;
};

export const duplicateProject = (id: string): IncentiveProject | null => {
    const projects = getIncentiveProjects();
    const source = projects.find(p => p.id === id);
    if (!source) return null;

    const newProject: IncentiveProject = {
        ...source,
        id: `proj_${Date.now()}`,
        name: `${source.name} (Copy)`,
        createdAt: new Date().toISOString(),
        // Keep the calculators but give them new IDs to avoid any potential collision 
        // (though IDs are scoped to projects usually, it's safer)
        calculators: source.calculators.map(c => ({ ...c, id: `calc_${Math.random().toString(36).substr(2, 9)}` }))
    };

    projects.push(newProject);
    saveIncentiveProjects(projects);
    return newProject;
};

export const duplicateCalculator = (projectId: string, calculatorId: string): IncentiveCalculator | null => {
    const projects = getIncentiveProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) return null;

    const source = projects[projectIndex].calculators.find(c => c.id === calculatorId);
    if (!source) return null;

    const newCalculator: IncentiveCalculator = {
        ...source,
        id: `calc_${Date.now()}`,
        name: `${source.name} (Copy)`,
        status: 'Draft' // Reset to draft for safety
    };

    projects[projectIndex].calculators.push(newCalculator);
    saveIncentiveProjects(projects);
    return newCalculator;
};
