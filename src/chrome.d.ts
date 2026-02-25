declare global {
    const chrome: {
        runtime: {
            lastError?: {
                message: string;
            };
            sendMessage: (message: unknown, responseCallback?: (response: unknown) => void) => void;
            onMessage: {
                addListener: (
                    callback: (
                        message: unknown,
                        sender: unknown,
                        sendResponse: (response?: unknown) => void,
                    ) => boolean | undefined,
                ) => void;
            };
        };
        storage: {
            local: {
                get: (
                    keys: string | string[] | Record<string, unknown> | null,
                    callback: (items: Record<string, unknown>) => void,
                ) => void;
                set: (items: Record<string, unknown>, callback?: () => void) => void;
            };
        };
        tabs: {
            query: (queryInfo: Record<string, unknown>) => Promise<ChromeTab[]>;
            sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
            onUpdated: {
                addListener: (
                    callback: (
                        tabId: number,
                        changeInfo: { status?: string },
                        tab: ChromeTab,
                    ) => void,
                ) => void;
            };
        };
    };

    interface ChromeTab {
        id?: number;
        url?: string;
    }
}

export {};
