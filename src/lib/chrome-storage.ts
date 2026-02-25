export async function readStorageBoolean(key: string): Promise<boolean | undefined> {
    return new Promise((resolve, reject) => {
        const storageLocal = chrome.storage?.local;
        if (!storageLocal) {
            resolve(undefined);
            return;
        }

        storageLocal.get([key], (items) => {
            const runtimeError = chrome.runtime.lastError;
            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }
            const value = items[key];
            resolve(typeof value === "boolean" ? value : undefined);
        });
    });
}

export async function writeStorageBoolean(key: string, value: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
        const storageLocal = chrome.storage?.local;
        if (!storageLocal) {
            resolve();
            return;
        }

        storageLocal.set({ [key]: value }, () => {
            const runtimeError = chrome.runtime.lastError;
            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }
            resolve();
        });
    });
}
