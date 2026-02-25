import { fail, handleMessage, isBackgroundMessage } from "@/background/handlers";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isBackgroundMessage(message)) {
        return undefined;
    }

    void handleMessage(message)
        .then((response) => {
            sendResponse(response);
        })
        .catch((error: unknown) => {
            const messageText =
                error instanceof Error ? error.message : "Unexpected background error.";
            sendResponse(fail(messageText));
        });

    return true;
});
