import lodash from 'lodash';
import chalk from 'chalk';
import { t } from '../utils.js';
import type { AgentMemory } from '../agent/types.js';

const { get, set, keys, has } = lodash;
let agentMemoryRef: AgentMemory | null = null;
export function setAgentMemoryRef(memory: AgentMemory) {
    agentMemoryRef = memory;
}

/**
 * Converts a slash-separated path to dot notation for lodash
 * Example: 'tdarr/jobs/clean' -> 'tdarr.jobs.clean'
 */
function normalizePath(path: string): string {
    if (!path) return '';
    // Replace forward slashes with dots for lodash path access
    return path.includes('/') ? path.replace(/\//g, '.') : path;
}

export async function get_memory_keys(path?: string): Promise<string[]> {
    if (!path) path = '';
    if (path === '/') path = '';
    if (path === 'root') path = '';
    
    console.log(chalk.yellow(t('memoryGettingKeys', { path: path || 'root' })));
    if (!agentMemoryRef) throw new Error(t('errorMemoryNotInitialized'));
    
    try {
        // Conversion automatique des chemins avec slash en notation par points
        let dotPath = path;
        if (path && path.includes('/')) {
            dotPath = path.replace(/\//g, '.');
        }
        
        const target = dotPath ? get(agentMemoryRef, dotPath) : agentMemoryRef;
        if (target === undefined || target === null) {
            console.log(chalk.yellow(t('memoryPathNotFound', { path: path || 'root' })));
            return [];
        }
        
        if (typeof target !== 'object') {
            throw new Error(t('errorMemoryPathNotObject', { path: path || 'root' }));
        }
        
        const keyList = keys(target);
        console.log(chalk.green(t('memoryGetKeysSuccess', { path: path || 'root' })));
        return keyList;
    } catch (error: any) {
        console.error(chalk.red(t('memoryGetKeysError', { path: path || 'root', message: error.message })));
        throw new Error(t('memoryGetKeysErrorFeedback', { path: path || 'root', message: error.message }));
    }
}

export async function get_memory_value(path: string): Promise<any> {
    console.log(chalk.yellow(t('memoryGettingValue', { path })));
    if (!agentMemoryRef) throw new Error(t('errorMemoryNotInitialized'));
    if (!path) throw new Error(t('errorMemoryPathRequired'));
    
    try {
        // Conversion automatique des chemins avec slash en notation par points
        let dotPath = path;
        if (path.includes('/')) {
            dotPath = path.replace(/\//g, '.');
        }
        
        if (!has(agentMemoryRef, dotPath)) {
            console.log(chalk.yellow(t('memoryPathNotFound', { path })));
            return `Error: Path not found in memory: ${path}`;
        }
        
        const value = get(agentMemoryRef, dotPath);
        console.log(chalk.green(t('memoryGetValueSuccess', { path })));
        return value;
    } catch (error: any) {
        console.error(chalk.red(t('memoryGetValueError', { path, message: error.message })));
        throw new Error(t('memoryGetValueErrorFeedback', { path, message: error.message }));
    }
}

export async function set_memory_value(path: string, value: any): Promise<string> {
    console.log(chalk.yellow(t('memorySettingValue', { path })));
    if (!agentMemoryRef) throw new Error(t('errorMemoryNotInitialized'));
    if (!path) throw new Error(t('errorMemoryPathRequired'));
    
    try {
        // Conversion automatique des chemins plats en structure hiérarchique
        if (path.includes('/')) {
            // Conversion des chemins avec slash en notation par points pour lodash
            const dotPath = path.replace(/\//g, '.');
            set(agentMemoryRef, dotPath, value);
        } else {
            // Support du format original pour compatibilité
            set(agentMemoryRef, path, value);
        }
        
        console.log(chalk.green(t('memorySetValueSuccess', { path })));
        console.log(chalk.dim(`[Memory Update Tool] ${path} = ${JSON.stringify(value)}`));
        return t('memorySetValueSuccessFeedback', { path });
    } catch (error: any) {
        console.error(chalk.red(t('memorySetValueError', { path, message: error.message })));
        throw new Error(t('memorySetValueErrorFeedback', { path, message: error.message }));
    }
}
