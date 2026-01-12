/**
 * DebugLogger - Centralized debug logging with timestamps and replay capability
 * Provides structured logging for form automation operations
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    ts: string;          // ISO timestamp
    tms: number;         // Performance timestamp in ms
    type: string;        // Event type
    level: LogLevel;
    payload: any;
}

export interface DebugConfig {
    enabled: boolean;
    logDropdownTiming: boolean;
    logMutationObserver: boolean;
    logSyncLocks: boolean;
    trackFailedFields: boolean;
    exportLogsToFile: boolean;
}

// Browser-safe default - can be overridden via init()
export const DEFAULT_DEBUG_CONFIG: DebugConfig = {
    enabled: false,  // Set to true via init() for development
    logDropdownTiming: true,
    logMutationObserver: true,
    logSyncLocks: true,
    trackFailedFields: true,
    exportLogsToFile: false
};

class DebugLoggerClass {
    private enabled: boolean = false;
    private config: DebugConfig = DEFAULT_DEBUG_CONFIG;
    private events: LogEntry[] = [];
    private failedSteps: any[] = [];
    private startTime: number = performance.now();

    init(config?: Partial<DebugConfig>): void {
        this.config = { ...DEFAULT_DEBUG_CONFIG, ...config };
        this.enabled = this.config.enabled;
        this.startTime = performance.now();

        if (this.enabled) {
            console.log('[AWL DebugLogger] Initialized', this.config);
        }
    }

    log(type: string, payload: any = {}, level: LogLevel = 'info'): void {
        if (!this.enabled) return;

        const entry: LogEntry = {
            ts: new Date().toISOString(),
            tms: Math.round(performance.now() - this.startTime),
            type,
            level,
            payload
        };

        this.events.push(entry);

        // Console output with color coding
        const prefix = `[AWL][${entry.tms}ms][${type}]`;
        switch (level) {
            case 'error':
                console.error(prefix, payload);
                break;
            case 'warn':
                console.warn(prefix, payload);
                break;
            case 'debug':
                console.debug(prefix, payload);
                break;
            default:
                console.log(prefix, payload);
        }
    }

    debug(type: string, payload: any = {}): void {
        this.log(type, payload, 'debug');
    }

    info(type: string, payload: any = {}): void {
        this.log(type, payload, 'info');
    }

    warn(type: string, payload: any = {}): void {
        this.log(type, payload, 'warn');
    }

    error(type: string, payload: any = {}): void {
        this.log(type, payload, 'error');
    }

    markFailed(step: any): void {
        if (!this.config.trackFailedFields) return;

        this.failedSteps.push({
            ...step,
            timestamp: new Date().toISOString()
        });
        this.error('FAILED_STEP', step);
    }

    getHistory(): LogEntry[] {
        return [...this.events];
    }

    getFailedSteps(): any[] {
        return [...this.failedSteps];
    }

    exportLogs(): string {
        const exportData = {
            createdAt: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : '',
            totalEvents: this.events.length,
            totalFailedSteps: this.failedSteps.length,
            config: this.config,
            events: this.events,
            failedSteps: this.failedSteps
        };

        return JSON.stringify(exportData, null, 2);
    }

    clear(): void {
        this.events = [];
        this.failedSteps = [];
        this.startTime = performance.now();
        this.info('LOGGER_CLEARED', {});
    }

    // Timing utilities
    startTimer(label: string): () => number {
        const start = performance.now();
        return () => {
            const elapsed = Math.round(performance.now() - start);
            this.debug('TIMER', { label, elapsed });
            return elapsed;
        };
    }
}

// Singleton instance
export const DebugLogger = new DebugLoggerClass();

// Make available globally for browser console access
if (typeof window !== 'undefined') {
    (window as any).__AWL_DEBUG__ = DebugLogger;
}
