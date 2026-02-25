import { sendRuntimeMessage } from "@/lib/runtime";
import type { BridgeRulesSyncMessage, RulesPushMessage, RulesSyncPayload } from "@/lib/types";
import { ECHO_BRIDGE_SOURCE, ECHO_RULES_SYNC_TYPE } from "@/lib/types";

declare global {
    interface Window {
        __echoContentBridgeInstalled?: boolean;
    }
}

function isRulesPushMessage(value: unknown): value is RulesPushMessage {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<RulesPushMessage>;
    return (
        candidate.type === "rules:push" &&
        typeof candidate.payload === "object" &&
        candidate.payload !== null
    );
}

function forwardRulesToPage(payload: RulesSyncPayload): void {
    const outgoing: BridgeRulesSyncMessage = {
        source: ECHO_BRIDGE_SOURCE,
        type: ECHO_RULES_SYNC_TYPE,
        payload,
    };
    window.postMessage(outgoing, "*");
}

function installContentBridge(): void {
    if (window.__echoContentBridgeInstalled) {
        return;
    }
    window.__echoContentBridgeInstalled = true;

    // Listen for rules:push messages from the background service worker.
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (isRulesPushMessage(message)) {
            forwardRulesToPage(message.payload);
            sendResponse({ ok: true });
        }
        return undefined;
    });

    // Request an initial rules sync from the background on install.
    void (async () => {
        try {
            const response = await sendRuntimeMessage<RulesSyncPayload>({
                type: "rules:request-sync",
            });
            if (response.ok) {
                forwardRulesToPage(response.data);
            }
        } catch {
            // Background may not be ready yet; rules will arrive via push.
        }
    })();
}

export function onExecute(): void {
    installContentBridge();
}

installContentBridge();
