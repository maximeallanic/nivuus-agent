// Path and configuration constants extracted
import path from 'node:path';
import os from 'node:os';

const configDir = path.join(os.homedir(), '.config', 'nivuus-agent');
export const HISTORY_FILE: string = path.join(configDir, 'conversation_history.json');
export const MEMORY_FILE: string = path.join(configDir, 'agent_memory.json');
export const MAX_ACTION_LOG_ENTRIES: number = 30;
export const MAX_HISTORY_LENGTH: number = 100; // Maximum number of messages in conversation history
export const MAX_DIRECT_READ_SIZE: number = 100 * 1024;
export const MAX_SEARCH_RESULTS: number = 5;
export const COMMAND_TIMEOUT_MS: number = 120000; // Default timeout set to 30 seconds
export const MAX_FEEDBACK_LEN: number = 40000;
export const MAX_COMMAND_OUTPUT_LENGTH: number = 10000; // Maximum number of characters for command output
