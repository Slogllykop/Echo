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

window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window) {
        return;
    }

    const incomingMessage = event.data;

    if (!isPageEvaluateMessage(incomingMessage)) {
        return;
    }

    void (async () => {
        const response = await sendRuntimeMessage<EvaluatePayload>({
            type: "interceptor:evaluate",
            request: incomingMessage.request,
        });

        const outgoingMessage: BridgeDecisionMessage = {
            source: ECHO_BRIDGE_SOURCE,
            type: ECHO_BRIDGE_RESPONSE_TYPE,
            requestId: incomingMessage.requestId,
            decision: response.ok
                ? response.data.decision
                : {
                      kind: "pass-through",
                      delayMs: 0,
                  },
        };

        window.postMessage(outgoingMessage, "*");
    })();
});
