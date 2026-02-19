import type { ApiResult, BackgroundMessage } from "@/lib/types";

export function sendRuntimeMessage<TPayload>(
    message: BackgroundMessage,
): Promise<ApiResult<TPayload>> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response: unknown) => {
            const runtimeError = chrome.runtime.lastError;
            if (runtimeError) {
                resolve({
                    ok: false,
                    error: runtimeError.message,
                });
                return;
            }

            if (!response) {
                resolve({
                    ok: false,
                    error: "No response from background service worker.",
                });
                return;
            }

            const typedResponse = response as ApiResult<TPayload>;
            if (
                typeof typedResponse !== "object" ||
                typedResponse === null ||
                !("ok" in typedResponse)
            ) {
                resolve({
                    ok: false,
                    error: "Received an invalid response from background service worker.",
                });
                return;
            }

            resolve(typedResponse);
        });
    });
}
