/**
 * Utility functions retained from the original decision bridge.
 * The cross-context messaging logic has been removed - rule evaluation
 * now happens locally via `rule-cache.ts`.
 */

export function sleep(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}
