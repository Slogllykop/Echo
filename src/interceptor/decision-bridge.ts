import {
    type BridgeDecisionMessage,
    ECHO_BRIDGE_RESPONSE_TYPE,
    ECHO_BRIDGE_SOURCE,
    ECHO_PAGE_REQUEST_TYPE,
    ECHO_PAGE_SOURCE,
    type InterceptDecision,
    type InterceptRequest,
} from "@/lib/types";

type PendingDecision = {
    resolve: (decision: InterceptDecision) => void;
    timeoutId: number;
};

const pendingDecisions = new Map<string, PendingDecision>();
const DECISION_TIMEOUT_MS = 1500;

function isBridgeDecisionMessage(value: unknown): value is BridgeDecisionMessage {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<BridgeDecisionMessage>;
    return (
        candidate.source === ECHO_BRIDGE_SOURCE &&
        candidate.type === ECHO_BRIDGE_RESPONSE_TYPE &&
        typeof candidate.requestId === "string" &&
        typeof candidate.decision === "object" &&
        candidate.decision !== null
    );
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window) {
        return;
    }

    if (!isBridgeDecisionMessage(event.data)) {
        return;
    }

    const pending = pendingDecisions.get(event.data.requestId);
    if (!pending) {
        return;
    }

    window.clearTimeout(pending.timeoutId);
    pendingDecisions.delete(event.data.requestId);
    pending.resolve(event.data.decision);
});

export function sleep(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

export function getDecision(request: InterceptRequest): Promise<InterceptDecision> {
    return new Promise((resolve) => {
        const requestId = crypto.randomUUID();
        const timeoutId = window.setTimeout(() => {
            pendingDecisions.delete(requestId);
            resolve({
                kind: "pass-through",
                delayMs: 0,
            });
        }, DECISION_TIMEOUT_MS);

        pendingDecisions.set(requestId, { resolve, timeoutId });

        window.postMessage(
            {
                source: ECHO_PAGE_SOURCE,
                type: ECHO_PAGE_REQUEST_TYPE,
                requestId,
                request,
            },
            "*",
        );
    });
}
