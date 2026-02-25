import {
    applyModifyDecision,
    buildMockResponse,
    toInterceptRequest,
} from "@/interceptor/body-utils";
import { sleep } from "@/interceptor/decision-bridge";
import { getLocalDecision, hasActiveRules } from "@/interceptor/rule-cache";

const nativeFetch = window.fetch.bind(window);

export { nativeFetch };

export function patchFetch(): void {
    // Use a regular (non-async) function so that the fast path returns
    // the native Promise directly — no extra microtask wrapping.
    window.fetch = function patchedFetch(
        input: RequestInfo | URL,
        init?: RequestInit,
    ): Promise<Response> {
        // ── Fast path: no rules active → call native with original args ──
        // This preserves the EXACT same behavior as if the extension wasn't
        // installed: same Request construction, same credentials, same signal,
        // same streaming config. Critically, no async wrapper overhead.
        if (!hasActiveRules()) {
            return nativeFetch(input, init);
        }

        // ── Slow path: rules are active, need to evaluate ──
        return (async () => {
            const request = new Request(input, init);
            const requestSnapshot = await toInterceptRequest(request);
            const decision = getLocalDecision(requestSnapshot);

            await sleep(decision.delayMs);

            if (decision.kind === "pass-through") {
                // Pass original arguments, not the wrapped Request, to
                // preserve any streaming/signal/credential behavior.
                return nativeFetch(input, init);
            }

            if (decision.kind === "mock") {
                return buildMockResponse(decision);
            }

            return applyModifyDecision(decision, request, nativeFetch);
        })();
    } as typeof window.fetch;
}
