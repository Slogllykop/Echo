import {
    broadcastRulesToAllTabs,
    fail,
    handleMessage,
    isBackgroundMessage,
} from "@/background/handlers";

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

// Push rules to tabs when they finish loading, so newly navigated pages
// get the current rule set immediately.
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") {
        return;
    }
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
        return;
    }

    // Small delay to ensure the content script is injected and ready.
    setTimeout(() => {
        void broadcastRulesToAllTabs();
    }, 100);
});
