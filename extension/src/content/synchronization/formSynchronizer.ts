/**
 * FormSynchronizer - Promise-based field locking and sequential fill orchestration
 * Ensures deterministic, race-condition-free form filling
 */

import { DebugLogger } from '../../utils/debugLogger';
import { DetectedField } from '../../types/fieldDetection';
import { FillResult } from '../actions/fieldFiller';

const DEFAULT_LOCK_TIMEOUT_MS = 20000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_BASE_MS = 180;
const DEFAULT_BACKOFF_FACTOR = 2.0;

export interface SynchronizerConfig {
    lockTimeoutMs?: number;
    maxRetries?: number;
    backoffBaseMs?: number;
    backoffFactor?: number;
}

export class FormSynchronizer {
    private locks: Map<string, Promise<void>> = new Map();
    private config: Required<SynchronizerConfig>;

    constructor(config: SynchronizerConfig = {}) {
        this.config = {
            lockTimeoutMs: config.lockTimeoutMs || DEFAULT_LOCK_TIMEOUT_MS,
            maxRetries: config.maxRetries || DEFAULT_MAX_RETRIES,
            backoffBaseMs: config.backoffBaseMs || DEFAULT_BACKOFF_BASE_MS,
            backoffFactor: config.backoffFactor || DEFAULT_BACKOFF_FACTOR
        };
    }

    /**
     * Execute a function with exclusive lock on a specific field
     * Ensures sequential access per field ID
     */
    async runLocked<T>(
        lockKey: string,
        fn: () => Promise<T>,
        timeoutMs?: number
    ): Promise<T> {
        const timeout = timeoutMs || this.config.lockTimeoutMs;

        // Wait for previous operation on this key
        const previousLock = this.locks.get(lockKey) || Promise.resolve();

        // Create new lock promise for next operation
        let release: () => void;
        const nextLock = new Promise<void>((resolve) => {
            release = resolve;
        });
        this.locks.set(lockKey, previousLock.then(() => nextLock));

        // Wait for previous to complete
        await previousLock;

        const started = performance.now();
        DebugLogger.info('LOCK_ACQUIRED', { lockKey });

        try {
            // Execute with timeout
            const result = await this.withTimeout(fn(), timeout, `lock(${lockKey})`);

            DebugLogger.info('LOCK_RELEASED', {
                lockKey,
                dt: Math.round(performance.now() - started)
            });

            return result;
        } finally {
            release!();
        }
    }

    /**
     * Execute function with timeout
     */
    private async withTimeout<T>(
        promise: Promise<T>,
        timeoutMs: number,
        label: string
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`${label} timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            promise
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Execute function with exponential backoff retries
     */
    async withRetries<T>(
        label: string,
        fn: (attempt: number) => Promise<T>,
        maxRetries?: number
    ): Promise<T> {
        const retries = maxRetries || this.config.maxRetries;
        let attempt = 0;
        let delay = this.config.backoffBaseMs;

        while (attempt < retries) {
            try {
                DebugLogger.debug('RETRY_ATTEMPT', {
                    label,
                    attempt: attempt + 1,
                    maxRetries: retries
                });

                return await fn(attempt);
            } catch (error) {
                attempt++;

                DebugLogger.warn('RETRY_ERROR', {
                    label,
                    attempt,
                    maxRetries: retries,
                    error: error instanceof Error ? error.message : String(error)
                });

                if (attempt >= retries) {
                    DebugLogger.error('RETRY_EXHAUSTED', {
                        label,
                        attempts: attempt,
                        finalError: error instanceof Error ? error.message : String(error)
                    });
                    throw error;
                }

                // Exponential backoff
                await this.sleep(delay);
                delay = Math.round(delay * this.config.backoffFactor);
            }
        }

        throw new Error(`${label} failed after ${retries} retries`);
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Fill a field with lock and retry logic
     * This is a convenience method that combines locking and retries
     */
    async fillFieldSafe(
        field: DetectedField,
        fillFn: (field: DetectedField) => Promise<FillResult>
    ): Promise<FillResult> {
        const lockKey = this.getFieldLockKey(field);

        return await this.runLocked(lockKey, async () => {
            return await this.withRetries(
                `fill:${lockKey}`,
                async () => {
                    return await fillFn(field);
                }
            );
        });
    }

    /**
     * Generate a stable lock key for a field
     */
    private getFieldLockKey(field: DetectedField): string {
        // Use element ID if available, otherwise use question text hash
        if (field.element.id) {
            return `field:${field.element.id}`;
        }

        // Generate stable hash from question text
        const hash = this.simpleHash(field.questionText);
        return `field:${hash}`;
    }

    /**
     * Simple string hash (FNV-1a)
     */
    private simpleHash(str: string): string {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return (hash >>> 0).toString(16);
    }

    /**
     * Clear all locks (useful for cleanup)
     */
    clearLocks(): void {
        this.locks.clear();
        DebugLogger.info('LOCKS_CLEARED', {});
    }

    /**
     * Get current lock count (for debugging)
     */
    getLockCount(): number {
        return this.locks.size;
    }
}
