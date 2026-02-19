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
    };
}

export {};
