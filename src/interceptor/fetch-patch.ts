import {
    applyModifyDecision,
    buildMockResponse,
    toInterceptRequest,
} from "@/interceptor/body-utils";
import { getDecision, sleep } from "@/interceptor/decision-bridge";

const nativeFetch = window.fetch.bind(window);

export { nativeFetch };

export function patchFetch(): void {
    const patchedFetch: typeof window.fetch = async (input, init) => {
        const request = new Request(input, init);
        const requestSnapshot = await toInterceptRequest(request);
        const decision = await getDecision(requestSnapshot);

        await sleep(decision.delayMs);

        if (decision.kind === "pass-through") {
            return nativeFetch(request);
        }

        if (decision.kind === "mock") {
            return buildMockResponse(decision);
        }

        return applyModifyDecision(decision, request, nativeFetch);
    };

    window.fetch = patchedFetch;
}
