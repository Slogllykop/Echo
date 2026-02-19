import { sendRuntimeMessage } from "@/lib/runtime";
import {
    type BridgeDecisionMessage,
    ECHO_BRIDGE_RESPONSE_TYPE,
    ECHO_BRIDGE_SOURCE,
    ECHO_PAGE_REQUEST_TYPE,
    ECHO_PAGE_SOURCE,
    type EvaluatePayload,
    type PageEvaluateMessage,
} from "@/lib/types";

declare global {
    interface Window {
        __echoContentBridgeInstalled?: boolean;
    }
}

function isPageEvaluateMessage(value: unknown): value is PageEvaluateMessage {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<PageEvaluateMessage>;
    return (
        candidate.source === ECHO_PAGE_SOURCE &&
        candidate.type === ECHO_PAGE_REQUEST_TYPE &&
        typeof candidate.requestId === "string" &&
        typeof candidate.request === "object" &&
        candidate.request !== null
    );
}

function installContentBridge(): void {
    if (window.__echoContentBridgeInstalled) {
        return;
    }
    window.__echoContentBridgeInstalled = true;

    window.addEventListener("message", (event: MessageEvent<unknown>) => {
        const incomingMessage = event.data;

        if (!isPageEvaluateMessage(incomingMessage)) {
            return;
        }

        void (async () => {
            let decision: BridgeDecisionMessage["decision"] = {
                kind: "pass-through",
                delayMs: 0,
            };

            try {
                const response = await sendRuntimeMessage<EvaluatePayload>({
                    type: "interceptor:evaluate",
                    request: incomingMessage.request,
                });
                if (response.ok) {
                    decision = response.data.decision;
                }
            } catch {
                // Keep pass-through fallback when runtime messaging fails unexpectedly.
            }

            const outgoingMessage: BridgeDecisionMessage = {
                source: ECHO_BRIDGE_SOURCE,
                type: ECHO_BRIDGE_RESPONSE_TYPE,
                requestId: incomingMessage.requestId,
                decision,
            };

            window.postMessage(outgoingMessage, "*");
        })();
    });
}

export function onExecute(): void {
    installContentBridge();
}

installContentBridge();
