// Script de migration pour la nouvelle structure hiérarchique
const fs = require('fs');
const path = require('path');
const os = require('os');

// Chemin correct du fichier mémoire
const configDir = path.join(os.homedir(), '.config', 'nivuus-agent');
const MEMORY_FILE = path.join(configDir, 'agent_memory.json');

// Fonction principale de migration
async function migrateMemory() {
  console.log('Starting memory migration...');
  
  try {
    // Créer un backup
    const backupPath = `${MEMORY_FILE}.backup-${Date.now()}`;
    console.log(`Creating backup at: ${backupPath}`);
    
    // Lire les données existantes
    let memoryData;
    try {
      memoryData = fs.readFileSync(MEMORY_FILE, 'utf-8');
    } catch (err) {
      console.error('Error reading memory file. Does it exist?', err);
      return;
    }
    
    // Sauvegarde
    fs.writeFileSync(backupPath, memoryData, 'utf-8');
    console.log('Backup created successfully');
    
    // Parser les données
    const memory = JSON.parse(memoryData);
    
    // Créer la nouvelle structure
    const newMemory = {
      logs: {
        actions: memory.action_log || []
      },
      system: {
        info: memory.system_info || {}
      },
      notes: memory.notes || "",
      // Garder les anciens champs pour la rétrocompatibilité
      action_log: memory.action_log || [],
      system_info: memory.system_info || {}
    };
    
    // Copier les autres champs
    Object.keys(memory).forEach(key => {
      if (!['action_log', 'system_info', 'notes'].includes(key)) {
        newMemory[key] = memory[key];
      }
    });
    
    // Écrire le fichier
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(newMemory, null, 2), 'utf-8');
    console.log('Memory migrated successfully');
    console.log('Migration completed!');
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Exécution de la migration
migrateMemory();
