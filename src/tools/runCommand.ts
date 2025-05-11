import { spawn, ChildProcess, SpawnOptions } from 'node:child_process';
import chalk from 'chalk';
import { t, updateMemory, getUserConfirmation } from '../utils.js';
import { COMMAND_TIMEOUT_MS, MAX_COMMAND_OUTPUT_LENGTH } from '../config/config.js';
import type { AgentMemory, ActionStatus } from '../agent/types.js';

let agentMemoryRef: AgentMemory | null = null;
export function setAgentMemoryRef(memory: AgentMemory) {
    agentMemoryRef = memory;
}

// Add optional timeoutMs parameter
export async function runCommand(command: string, purpose: string, timeoutMs?: number): Promise<string> {
    const effectiveTimeout = timeoutMs ?? COMMAND_TIMEOUT_MS; // Determine effective timeout
    const timeoutSeconds = effectiveTimeout / 1000; // Calculate seconds for display

    // Reinstate Confirmation block
    console.log(chalk.blue(chalk.bold(t('commandConfirmPrompt'))));
    console.log(chalk.yellow(t('commandConfirmProposed', { command }))); 
    console.log(chalk.blue(t('commandConfirmPurpose', { purpose: Buffer.from(purpose || t('notSpecified'), 'utf-8').toString() }))); 
    // Add timeout display
    console.log(chalk.blue(t('commandConfirmTimeout', { timeout: timeoutSeconds }))); 
    const confirm = await getUserConfirmation(t('confirmExecute'));

    if (!confirm) {
        console.log(chalk.yellow(t('executionCancelled')));
        if (agentMemoryRef) updateMemory(agentMemoryRef, "Command", command, "Cancelled");
        return t('executionCancelled');
    }
    // End Reinstate Confirmation block

    if (agentMemoryRef) updateMemory(agentMemoryRef, "Command", command, "Attempted");
    console.log(chalk.cyan(t('commandStartExecution', { command })));

    return new Promise((resolve) => {
        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];
        let stdoutOutput = "";
        let stderrOutput = "";
        let fullRawOutput = ""; // Declare fullRawOutput here
        let timedOut = false;
        let alreadyResolved = false; // Flag to prevent double resolution
        let manualTimeoutId: NodeJS.Timeout | null = null; // Variable for manual timeout ID

        const spawnOptions: SpawnOptions = {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: effectiveTimeout, // Use effective timeout
            detached: true // Add detached option
        };

        const childProcess: ChildProcess = spawn(command, [], spawnOptions);

        // --- Manual Timeout Implementation ---
        manualTimeoutId = setTimeout(() => {
            if (alreadyResolved) {
                return;
            }
            timedOut = true;
            alreadyResolved = true; // Set flag immediately

            const actualTimeoutSeconds = effectiveTimeout / 1000;
            const timeoutMsg = t('commandTimeoutErrorMsg', { timeout: actualTimeoutSeconds });
            console.log(chalk.red(t('commandTimeoutError', { timeout: actualTimeoutSeconds }) + ' (Manual Timeout)')); // Indicate manual trigger
            stderrChunks.push(timeoutMsg);

            // --- Kill Logic (same as before) ---
            if (childProcess.pid) {
                try {
                    process.kill(-childProcess.pid, 'SIGKILL');
                } catch (killError: any) {
                    if (!childProcess.killed) {
                        try {
                            childProcess.kill('SIGKILL');
                        } catch (mainKillError: any) {
                        }
                    }
                }
            } else if (!childProcess.killed) {
                 try {
                    childProcess.kill('SIGKILL');
                 } catch (fallbackKillError: any) {
                 }
            }
            // --- End Kill Logic ---

            // --- Resolve Logic (same as before) ---
            stdoutOutput = stdoutChunks.join('');
            stderrOutput = stderrChunks.join('');
            let fullRawOutput = "";
            if (stdoutOutput) fullRawOutput += `${t('commandOutputStdout')}\n${stdoutOutput.trim()}\n`;
            const finalStderr = `${stderrOutput.trim()} ${timeoutMsg}`.trim();
            fullRawOutput += `${t('commandOutputStderr')}\n${finalStderr}\n`;
            
            // Tronquer la sortie si elle dépasse MAX_COMMAND_OUTPUT_LENGTH
            let displayOutput = fullRawOutput;
            if (fullRawOutput.length > MAX_COMMAND_OUTPUT_LENGTH) {
                displayOutput = fullRawOutput.substring(0, MAX_COMMAND_OUTPUT_LENGTH) + 
                    `\n\n${t('commandOutputTruncated', { length: fullRawOutput.length, max: MAX_COMMAND_OUTPUT_LENGTH })}`;
            }
            
            console.log(chalk.grey(t('commandRawOutputTitle')));
            console.log(chalk.grey(displayOutput.substring(0, 500) + (displayOutput.length > 500 ? '...' : '')));
            console.log(chalk.grey(t('commandRawOutputEnd')));
            
            if (agentMemoryRef) updateMemory(agentMemoryRef, "Command", command, "Failure", finalStderr);
            
            // Retourner la sortie tronquée au lieu de la sortie complète
            if (fullRawOutput.length > MAX_COMMAND_OUTPUT_LENGTH) {
                const truncatedOutput = fullRawOutput.substring(0, MAX_COMMAND_OUTPUT_LENGTH) + 
                    `\n\n${t('commandOutputTruncated', { length: fullRawOutput.length, max: MAX_COMMAND_OUTPUT_LENGTH })}`;
                resolve(truncatedOutput.trim());
            } else {
                resolve(fullRawOutput.trim());
            }
            // --- End Resolve Logic ---

        }, effectiveTimeout);
        // --- End Manual Timeout Implementation ---

        if (childProcess.stdout) {
            childProcess.stdout.setEncoding('utf-8');
            childProcess.stdout.on('data', (data: string | Buffer) => stdoutChunks.push(data.toString()));
        }
        if (childProcess.stderr) {
            childProcess.stderr.setEncoding('utf-8');
            childProcess.stderr.on('data', (data: string | Buffer) => stderrChunks.push(data.toString()));
        }

        childProcess.on('error', (err: Error) => {
            if (manualTimeoutId) clearTimeout(manualTimeoutId); // Clear manual timeout on error
            if (alreadyResolved) {
                 return;
            }
            console.log(chalk.red(t('commandSpawnError', { message: err.message })));
            stderrChunks.push(`Spawn error: ${err.message}`);
            // Note: 'close' event will still likely fire after 'error', so we resolve there.
            // However, if 'close' doesn't fire, the promise might hang. Let's resolve here too for safety.
            // Update: Let's stick to resolving in 'close' or 'timeout' to avoid complex race conditions.
        });

        // Node.js internal timeout handler (keep as backup)
        childProcess.on('timeout', () => {
            if (manualTimeoutId) clearTimeout(manualTimeoutId); // Clear manual timeout if Node's fires first
            if (alreadyResolved) {
                return;
            }
            // Essentially duplicates the manual timeout logic now
            timedOut = true;
            alreadyResolved = true;
            const actualTimeoutSeconds = effectiveTimeout / 1000;
            const timeoutMsg = t('commandTimeoutErrorMsg', { timeout: actualTimeoutSeconds });
            console.log(chalk.red(t('commandTimeoutError', { timeout: actualTimeoutSeconds }) + ' (Node.js Internal)'));
            stderrChunks.push(timeoutMsg);
            // Kill logic...
            if (childProcess.pid) { 
                try {
                    process.kill(-childProcess.pid, 'SIGKILL');
                } catch (killError: any) {
                    if (!childProcess.killed) {
                        try {
                            childProcess.kill('SIGKILL');
                        } catch (mainKillError: any) {
                        }
                    }
                }
            } else if (!childProcess.killed) { 
                 try {
                    childProcess.kill('SIGKILL');
                 } catch (fallbackKillError: any) {
                 }
            }

            // Resolve logic...
            stdoutOutput = stdoutChunks.join('');
            stderrOutput = stderrChunks.join('');
            // Construct fullRawOutput within this scope
            fullRawOutput = ""; 
            if (stdoutOutput) fullRawOutput += `${t('commandOutputStdout')}\n${stdoutOutput.trim()}\n`;
            const finalStderr = `${stderrOutput.trim()} ${timeoutMsg}`.trim();
            fullRawOutput += `${t('commandOutputStderr')}\n${finalStderr}\n`;

            // Tronquer la sortie si elle dépasse MAX_COMMAND_OUTPUT_LENGTH
            let displayOutput = fullRawOutput;
            if (fullRawOutput.length > MAX_COMMAND_OUTPUT_LENGTH) {
                displayOutput = fullRawOutput.substring(0, MAX_COMMAND_OUTPUT_LENGTH) + 
                    `\n\n${t('commandOutputTruncated', { length: fullRawOutput.length, max: MAX_COMMAND_OUTPUT_LENGTH })}`;
            }

            console.log(chalk.grey(t('commandRawOutputTitle')));
            console.log(chalk.grey(displayOutput.substring(0, 500) + (displayOutput.length > 500 ? '...' : '')));
            console.log(chalk.grey(t('commandRawOutputEnd')));

            if (agentMemoryRef) updateMemory(agentMemoryRef, "Command", command, "Failure", finalStderr);
            
            // Retourner la sortie tronquée au lieu de la sortie complète
            if (fullRawOutput.length > MAX_COMMAND_OUTPUT_LENGTH) {
                const truncatedOutput = fullRawOutput.substring(0, MAX_COMMAND_OUTPUT_LENGTH) + 
                    `\n\n${t('commandOutputTruncated', { length: fullRawOutput.length, max: MAX_COMMAND_OUTPUT_LENGTH })}`;
                resolve(truncatedOutput.trim());
            } else {
                resolve(fullRawOutput.trim());
            }
        });

        childProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
            if (manualTimeoutId) clearTimeout(manualTimeoutId); // Clear manual timeout if process closes normally
            if (alreadyResolved) {
                return;
            }
            alreadyResolved = true; // Set flag

            stdoutOutput = stdoutChunks.join('');
            stderrOutput = stderrChunks.join('');
            // Use timedOut flag which *should* be false here, but check just in case
            const finalCode = timedOut ? -1 : (code ?? (signal ? -2 : -1)); // Should always be false if we got here
            const signalInfo = signal ? `, Signal: ${signal}` : '';
            console.log(chalk.cyan(t('commandEndExecution', { code: finalCode, signalInfo })));

            // ... rest of the close handler ...
            let fullRawOutput = "";
            if (stdoutOutput) fullRawOutput += `${t('commandOutputStdout')}\n${stdoutOutput.trim()}\n`;
            if (stderrOutput) fullRawOutput += `${t('commandOutputStderr')}\n${stderrOutput.trim()}\n`;
            if (!fullRawOutput && finalCode !== 0) fullRawOutput = t('commandOutputNoOutputCode', { code: finalCode, signalInfo });
            if (!fullRawOutput && finalCode === 0) fullRawOutput = t('commandOutputNoOutputSuccess');

            // Tronquer la sortie si elle dépasse MAX_COMMAND_OUTPUT_LENGTH
            let displayOutput = fullRawOutput;
            if (fullRawOutput.length > MAX_COMMAND_OUTPUT_LENGTH) {
                displayOutput = fullRawOutput.substring(0, MAX_COMMAND_OUTPUT_LENGTH) + 
                    `\n\n${t('commandOutputTruncated', { length: fullRawOutput.length, max: MAX_COMMAND_OUTPUT_LENGTH })}`;
            }

            console.log(chalk.grey(t('commandRawOutputTitle')));
            console.log(chalk.grey(displayOutput.substring(0, 500) + (displayOutput.length > 500 ? '...' : '')));
            console.log(chalk.grey(t('commandRawOutputEnd')));

            const finalStatus: ActionStatus = finalCode === 0 ? "Success" : "Failure";
            if (agentMemoryRef) updateMemory(agentMemoryRef, "Command", command, finalStatus, stderrOutput.trim());

            // Retourner la sortie tronquée au lieu de la sortie complète
            if (fullRawOutput.length > MAX_COMMAND_OUTPUT_LENGTH) {
                const truncatedOutput = fullRawOutput.substring(0, MAX_COMMAND_OUTPUT_LENGTH) + 
                    `\n\n${t('commandOutputTruncated', { length: fullRawOutput.length, max: MAX_COMMAND_OUTPUT_LENGTH })}`;
                resolve(truncatedOutput.trim());
            } else {
                resolve(fullRawOutput.trim());
            }
        });
    });
}
