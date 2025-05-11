import chalk from 'chalk';
import { t } from '../utils.js';
import { MAX_ACTION_LOG_ENTRIES } from '../config/config.js';
import type { AgentMemory, ActionLogEntry, ActionStatus } from '../agent/types.js';

export function updateMemory(
    memory: AgentMemory | null,
    actionType: string,
    target: string,
    status: ActionStatus,
    errorMsg: string | null | undefined = null
): void {
    // Validate memory object
    if (!memory || typeof memory !== 'object') {
        console.error(chalk.red(t('invalidMemoryUpdate')));
        return;
    }

    // Create a new log entry with timestamp and action details
    const timestamp = new Date().toISOString();
    const logEntry: ActionLogEntry = {
        timestamp,
        actionType,
        target,
        status
    };
    if (errorMsg) {
        logEntry.errorMsg = errorMsg;
    }

    // Mise à jour pour la nouvelle structure hiérarchique
    // 1. S'assurer que logs.actions existe
    if (!memory.logs) {
        memory.logs = { actions: [] };
    } else if (!memory.logs.actions) {
        memory.logs.actions = [];
    }
    
    // Ajouter l'entrée dans la nouvelle structure
    memory.logs.actions.push(logEntry);
    
    // Garder logs.actions dans la limite de taille
    if (memory.logs.actions.length > MAX_ACTION_LOG_ENTRIES) {
        memory.logs.actions.shift();
    }
    
    // Rétrocompatibilité avec l'ancienne structure
    if (!memory.action_log) {
        memory.action_log = [];
    }
    memory.action_log.push(logEntry);
    if (memory.action_log.length > MAX_ACTION_LOG_ENTRIES) {
        memory.action_log.shift();
    }
}
