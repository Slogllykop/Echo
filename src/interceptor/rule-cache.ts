import { evaluateRules } from "@/lib/rule-engine";
import type {
    BridgeRulesSyncMessage,
    EchoRule,
    InterceptDecision,
    InterceptRequest,
    RulesSyncPayload,
} from "@/lib/types";
import { ECHO_BRIDGE_SOURCE, ECHO_RULES_SYNC_TYPE } from "@/lib/types";

let cachedRules: EchoRule[] = [];
let extensionEnabled = false;
let initialized = false;

function isBridgeRulesSyncMessage(value: unknown): value is BridgeRulesSyncMessage {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<BridgeRulesSyncMessage>;
    return (
        candidate.source === ECHO_BRIDGE_SOURCE &&
        candidate.type === ECHO_RULES_SYNC_TYPE &&
        typeof candidate.payload === "object" &&
        candidate.payload !== null
    );
}

function applySync(payload: RulesSyncPayload): void {
    cachedRules = payload.rules;
    extensionEnabled = payload.extensionEnabled;
    initialized = true;
}

/**
 * Returns true only if there are enabled rules and the extension is active.
 * Used by fetch/XHR patches to skip ALL interception overhead when there is
 * nothing to evaluate - achieving true zero-cost passthrough.
 */
export function hasActiveRules(): boolean {
    if (!initialized || !extensionEnabled) {
        return false;
    }
    return cachedRules.some((rule) => rule.enabled);
}

/**
 * Returns a synchronous decision for the given request using the locally
 * cached rules. This is the hot-path replacement for the old async
 * `getDecision()` bridge call - zero messaging, zero async overhead.
 */
export function getLocalDecision(request: InterceptRequest): InterceptDecision {
    if (!initialized || !extensionEnabled) {
        return { kind: "pass-through", delayMs: 0 };
    }

    return evaluateRules(cachedRules, request);
}

/**
 * Initializes the rule cache listener. Must be called once at page startup
 * (MAIN world). Listens for `echo:rules-sync` messages pushed from the
 * content bridge.
 */
export function initRuleCache(): void {
    window.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (event.source !== window) {
            return;
        }

        if (!isBridgeRulesSyncMessage(event.data)) {
            return;
        }

        applySync(event.data.payload);
    });
}
