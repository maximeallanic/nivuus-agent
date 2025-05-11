// Types and interfaces extracted from agent.ts
export type ActionStatus = 'Attempted' | 'Success' | 'Failure' | 'Cancelled' | 'Success (No Results)';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    name?: string;
    tool_calls?: any[];
    tool_call_id?: string;
}

export interface ActionLogEntry {
    timestamp: string;
    actionType: string;
    target: string;
    status: ActionStatus;
    errorMsg?: string | null;
}

/**
 * New hierarchical structure for agent memory
 * - Use logs/actions instead of action_log
 * - Use system/info instead of system_info
 */
export interface AgentMemory {
    logs?: {
        actions: ActionLogEntry[];
        [key: string]: any;
    };
    system?: {
        info: any;
        [key: string]: any;
    };
    notes: string;
    // Support for legacy format (temporary, will be removed in future)
    system_info?: any;
    action_log?: ActionLogEntry[];
    // Allow arbitrary properties for extensibility
    [key: string]: any;
}
