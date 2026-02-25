import {
    applyHeaderPatch,
    applyModifyDecision,
    buildMockResponse,
    hasRequestBody,
    normalizeXhrBody,
    patchBodyText,
    type XhrSendBody,
} from "@/interceptor/body-utils";
import { getDecision, sleep } from "@/interceptor/decision-bridge";
import { nativeFetch } from "@/interceptor/fetch-patch";
import {
    emitProgressEvent,
    emitReadyStateChange,
    emitSyntheticAbort,
    getNativeXhrValue,
    getSyntheticState,
    installSyntheticXhrOverrides,
    readSyntheticXhrBody,
    resetSyntheticState,
    responseTypeDescriptor,
} from "@/interceptor/xhr-synthetic";
import type { InterceptRequest } from "@/lib/types";

interface XhrMeta {
    method: string;
    url: string;
    async: boolean;
    requestHeaders: Record<string, string>;
    sendCalled: boolean;
    aborted: boolean;
    nativeSent: boolean;
    syntheticController?: AbortController;
}

const xhrMetaByInstance = new WeakMap<XMLHttpRequest, XhrMeta>();

const xhrPrototype = XMLHttpRequest.prototype;
const originalXhrOpen = xhrPrototype.open;
const originalXhrSend = xhrPrototype.send;
const originalXhrAbort = xhrPrototype.abort;
const originalXhrSetRequestHeader = xhrPrototype.setRequestHeader;

async function processXhrSend(xhr: XMLHttpRequest, body: XhrSendBody): Promise<void> {
    const meta = xhrMetaByInstance.get(xhr);
    if (!meta) {
        originalXhrSend.call(xhr, body as Document | XMLHttpRequestBodyInit | null);
        return;
    }

    if (meta.aborted) {
        return;
    }

    const absoluteUrl = new URL(meta.url, window.location.href).href;
    const normalizedBody = normalizeXhrBody(body);
    const requestSnapshot: InterceptRequest = {
        url: absoluteUrl,
        method: meta.method,
        headers: { ...meta.requestHeaders },
        body: normalizedBody.textBody,
    };

    const decision = await getDecision(requestSnapshot);

    if (meta.aborted) {
        return;
    }

    await sleep(decision.delayMs);

    if (meta.aborted) {
        return;
    }

    if (decision.kind === "pass-through") {
        meta.nativeSent = true;
        originalXhrSend.call(xhr, body as Document | XMLHttpRequestBodyInit | null);
        return;
    }

    const state = getSyntheticState(xhr);
    state.useSynthetic = true;
    state.readyState = 1;
    state.responseType = getNativeXhrValue(responseTypeDescriptor, xhr, "");

    emitProgressEvent(xhr, "loadstart");

    try {
        const requestHeaders = new Headers(meta.requestHeaders);
        const requestBodyPatch = decision.kind === "modify" ? decision.modify.request : undefined;
        const requestBodyStrategy = requestBodyPatch?.bodyStrategy ?? "none";
        const patchedRequestHeaders =
            decision.kind === "modify"
                ? applyHeaderPatch(requestHeaders, requestBodyPatch?.headers ?? {})
                : requestHeaders;
        let requestBody = hasRequestBody(meta.method) ? normalizedBody.transportBody : undefined;

        if (
            decision.kind === "modify" &&
            hasRequestBody(meta.method) &&
            requestBodyStrategy !== "none"
        ) {
            const originalRequestBody = normalizedBody.textBody ?? "";
            requestBody = patchBodyText(
                originalRequestBody,
                requestBodyStrategy,
                requestBodyPatch?.body ?? "",
                requestBodyPatch?.jsonPatch ?? {},
            );
            patchedRequestHeaders.delete("content-length");
        }

        const fetchRequest = new Request(absoluteUrl, {
            method: meta.method,
            headers: patchedRequestHeaders,
            body: requestBody,
            credentials: xhr.withCredentials ? "include" : "same-origin",
            signal: undefined,
        });

        let response: Response;

        if (decision.kind === "mock") {
            response = buildMockResponse(decision);
        } else {
            meta.syntheticController = new AbortController();
            const requestWithSignal = new Request(fetchRequest, {
                signal: meta.syntheticController.signal,
            });
            response = await applyModifyDecision(decision, requestWithSignal, nativeFetch);
        }

        state.status = response.status;
        state.statusText = response.statusText;
        state.responseURL = response.url || absoluteUrl;
        state.responseHeaders = new Headers(response.headers);

        emitReadyStateChange(xhr, 2);
        emitReadyStateChange(xhr, 3);

        const payload = await readSyntheticXhrBody(response, state.responseType);
        state.response = payload.response;
        state.responseText = payload.responseText;

        emitReadyStateChange(xhr, 4);
        emitProgressEvent(xhr, "load");
        emitProgressEvent(xhr, "loadend");
    } catch (error) {
        if (meta.aborted) {
            emitSyntheticAbort(xhr);
            return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
            emitSyntheticAbort(xhr);
            return;
        }

        state.status = 0;
        state.statusText = "";
        emitReadyStateChange(xhr, 4);
        emitProgressEvent(xhr, "error");
        emitProgressEvent(xhr, "loadend");
    }
}

export function patchXmlHttpRequest(): void {
    xhrPrototype.open = function open(
        method: string,
        url: string | URL,
        async?: boolean,
        username?: string | null,
        password?: string | null,
    ): void {
        const asyncFlag = async !== false;
        xhrMetaByInstance.set(this, {
            method: method.toUpperCase(),
            url: String(url),
            async: asyncFlag,
            requestHeaders: {},
            sendCalled: false,
            aborted: false,
            nativeSent: false,
            syntheticController: undefined,
        });
        resetSyntheticState(this);
        originalXhrOpen.call(this, method, url, asyncFlag, username, password);
    };

    xhrPrototype.setRequestHeader = function setRequestHeader(name: string, value: string): void {
        const meta = xhrMetaByInstance.get(this);
        if (meta) {
            const existingValue = meta.requestHeaders[name];
            meta.requestHeaders[name] = existingValue ? `${existingValue}, ${value}` : value;
        }
        originalXhrSetRequestHeader.call(this, name, value);
    };

    xhrPrototype.send = function send(body?: Document | XMLHttpRequestBodyInit | null): void {
        const meta = xhrMetaByInstance.get(this);
        if (!meta || meta.async === false) {
            originalXhrSend.call(this, body ?? null);
            return;
        }

        if (meta.sendCalled) {
            return;
        }
        meta.sendCalled = true;
        installSyntheticXhrOverrides(this);
        void processXhrSend(this, body);
    };

    xhrPrototype.abort = function abort(): void {
        const meta = xhrMetaByInstance.get(this);
        if (!meta) {
            originalXhrAbort.call(this);
            return;
        }

        meta.aborted = true;

        if (meta.nativeSent) {
            originalXhrAbort.call(this);
            return;
        }

        meta.syntheticController?.abort();

        if (!meta.syntheticController) {
            installSyntheticXhrOverrides(this);
            emitSyntheticAbort(this);
        }
    };
}
