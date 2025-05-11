import fs from 'node:fs/promises';
import path from 'node:path';
import { MEMORY_FILE } from '../config/config';
import type { AgentMemory } from '../agent/types';
import chalk from 'chalk';

/**
 * Migrates the old flat structure memory to a new hierarchical structure
 * - Moves action_log to logs/actions
 * - Moves system_info to system/info
 */
async function migrateMemory() {
  console.log(chalk.blue('Starting memory migration...'));
  
  try {
    // Create backup file
    const backupPath = `${MEMORY_FILE}.backup-${Date.now()}`;
    console.log(chalk.yellow(`Creating backup at: ${backupPath}`));
    
    // Read existing memory file
    const memoryData = await fs.readFile(MEMORY_FILE, 'utf-8');
    
    // Save backup
    await fs.writeFile(backupPath, memoryData, 'utf-8');
    console.log(chalk.green('Backup created successfully'));
    
    // Parse memory data
    const memory: AgentMemory = JSON.parse(memoryData);
    
    // Create new structure
    const newMemory: any = {
      logs: {
        actions: memory.action_log || []
      },
      system: {
        info: memory.system_info || {}
      },
      notes: memory.notes || ""
    };
    
    // Copy any other fields that might exist
    Object.keys(memory).forEach(key => {
      if (!['action_log', 'system_info', 'notes'].includes(key)) {
        newMemory[key] = memory[key];
      }
    });
    
    // Write new memory file
    await fs.writeFile(MEMORY_FILE, JSON.stringify(newMemory, null, 2), 'utf-8');
    console.log(chalk.green('Memory migrated successfully'));
    console.log(chalk.blue('Migration completed!'));
    
  } catch (error) {
    console.error(chalk.red('Error during migration:'), error);
    process.exit(1);
  }
}

// Run migration if executed directly
// Utiliser une approche simple basée sur le nom du fichier
const scriptName = process.argv[1] || '';
if (scriptName.includes('migrateMemory')) {
  migrateMemory();
}

export { migrateMemory };
