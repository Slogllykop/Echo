import {
    type BodyPatchStrategy,
    type BridgeDecisionMessage,
    ECHO_BRIDGE_RESPONSE_TYPE,
    ECHO_BRIDGE_SOURCE,
    ECHO_PAGE_REQUEST_TYPE,
    ECHO_PAGE_SOURCE,
    type InterceptDecision,
    type InterceptRequest,
    type MockDecision,
    type ModifyDecision,
} from "@/lib/types";

type PendingDecision = {
    resolve: (decision: InterceptDecision) => void;
    timeoutId: number;
};

type XhrSendBody = Document | XMLHttpRequestBodyInit | null | undefined;

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

interface SyntheticXhrState {
    useSynthetic: boolean;
    readyState: number;
    status: number;
    statusText: string;
    responseType: XMLHttpRequestResponseType;
    responseText: string;
    response: unknown;
    responseURL: string;
    responseHeaders: Headers;
}

const pendingDecisions = new Map<string, PendingDecision>();
const DECISION_TIMEOUT_MS = 1500;
const nativeFetch = window.fetch.bind(window);
const xhrMetaByInstance = new WeakMap<XMLHttpRequest, XhrMeta>();
const syntheticXhrStateByInstance = new WeakMap<XMLHttpRequest, SyntheticXhrState>();
const patchedXhrInstances = new WeakSet<XMLHttpRequest>();

const xhrPrototype = XMLHttpRequest.prototype;
const originalXhrOpen = xhrPrototype.open;
const originalXhrSend = xhrPrototype.send;
const originalXhrAbort = xhrPrototype.abort;
const originalXhrSetRequestHeader = xhrPrototype.setRequestHeader;
const originalXhrGetResponseHeader = xhrPrototype.getResponseHeader;
const originalXhrGetAllResponseHeaders = xhrPrototype.getAllResponseHeaders;

const readyStateDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "readyState");
const statusDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "status");
const statusTextDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "statusText");
const responseDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "response");
const responseTextDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "responseText");
const responseURLDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "responseURL");
const responseTypeDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "responseType");

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

function sleep(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function hasRequestBody(method: string): boolean {
    return method !== "GET" && method !== "HEAD";
}

function headersToRecord(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of headers.entries()) {
        result[key] = value;
    }
    return result;
}

async function toInterceptRequest(request: Request): Promise<InterceptRequest> {
    let body: string | undefined;
    const method = request.method.toUpperCase();

    if (hasRequestBody(method)) {
        try {
            body = await request.clone().text();
        } catch {
            body = undefined;
        }
    }

    return {
        url: request.url,
        method,
        headers: headersToRecord(request.headers),
        body,
    };
}

function getDecision(request: InterceptRequest): Promise<InterceptDecision> {
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

function normalizeXhrBody(body: XhrSendBody): {
    transportBody: BodyInit | undefined;
    textBody: string | undefined;
} {
    if (body === undefined || body === null) {
        return { transportBody: undefined, textBody: undefined };
    }

    if (typeof body === "string") {
        return { transportBody: body, textBody: body };
    }

    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        const text = body.toString();
        return { transportBody: body, textBody: text };
    }

    if (typeof Document !== "undefined" && body instanceof Document) {
        const serialized = new XMLSerializer().serializeToString(body);
        return { transportBody: serialized, textBody: serialized };
    }

    if (typeof FormData !== "undefined" && body instanceof FormData) {
        return { transportBody: body, textBody: undefined };
    }

    if (typeof Blob !== "undefined" && body instanceof Blob) {
        return { transportBody: body, textBody: undefined };
    }

    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        return { transportBody: body as BodyInit, textBody: undefined };
    }

    return { transportBody: undefined, textBody: undefined };
}

function applyHeaderPatch(headers: Headers, patch: Record<string, string>): Headers {
    const nextHeaders = new Headers(headers);
    for (const [key, value] of Object.entries(patch)) {
        if (!value) {
            nextHeaders.delete(key);
            continue;
        }
        nextHeaders.set(key, value);
    }
    return nextHeaders;
}

function buildMockResponse(decision: MockDecision): Response {
    return new Response(decision.mock.body, {
        status: decision.mock.status,
        statusText: decision.mock.statusText,
        headers: decision.mock.headers,
    });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(
    baseValue: Record<string, unknown>,
    patchValue: Record<string, unknown>,
): Record<string, unknown> {
    const output: Record<string, unknown> = { ...baseValue };

    for (const [key, value] of Object.entries(patchValue)) {
        const existingValue = output[key];
        if (isPlainObject(existingValue) && isPlainObject(value)) {
            output[key] = deepMerge(existingValue, value);
            continue;
        }
        output[key] = value;
    }

    return output;
}

function patchBodyText(
    originalBody: string,
    strategy: BodyPatchStrategy,
    replacementBody: string,
    jsonPatch: Record<string, unknown>,
): string {
    if (strategy === "none") {
        return originalBody;
    }

    if (strategy === "replace") {
        return replacementBody;
    }

    try {
        const parsedOriginal = JSON.parse(originalBody) as unknown;
        if (!isPlainObject(parsedOriginal)) {
            return originalBody;
        }

        const merged = deepMerge(parsedOriginal, jsonPatch);
        return JSON.stringify(merged);
    } catch {
        return originalBody;
    }
}

async function createPatchedRequestForModify(
    decision: ModifyDecision,
    request: Request,
): Promise<Request> {
    const requestPatch = decision.modify.request;
    const patchedHeaders = applyHeaderPatch(request.headers, requestPatch.headers ?? {});
    const requestBodyStrategy = requestPatch.bodyStrategy ?? "none";

    if (requestBodyStrategy === "none" || !hasRequestBody(request.method.toUpperCase())) {
        return new Request(request, {
            headers: patchedHeaders,
        });
    }

    let originalRequestBody = "";
    try {
        originalRequestBody = await request.clone().text();
    } catch {
        originalRequestBody = "";
    }

    const patchedRequestBody = patchBodyText(
        originalRequestBody,
        requestBodyStrategy,
        requestPatch.body ?? "",
        requestPatch.jsonPatch ?? {},
    );
    patchedHeaders.delete("content-length");

    return new Request(request, {
        headers: patchedHeaders,
        body: patchedRequestBody,
    });
}

async function applyModifyDecision(
    decision: ModifyDecision,
    request: Request,
    originalFetch: typeof fetch,
): Promise<Response> {
    const patchedRequest = await createPatchedRequestForModify(decision, request);

    const originalResponse = await originalFetch(patchedRequest);
    const responsePatch = decision.modify.response;
    const responseBodyStrategy = responsePatch.bodyStrategy ?? "none";
    const hasResponsePatch =
        typeof responsePatch.status === "number" ||
        Object.keys(responsePatch.headers).length > 0 ||
        responseBodyStrategy !== "none";

    if (!hasResponsePatch) {
        return originalResponse;
    }

    const headers = applyHeaderPatch(originalResponse.headers, responsePatch.headers);
    const status = responsePatch.status ?? originalResponse.status;
    const statusText = originalResponse.statusText;

    if (responseBodyStrategy === "none") {
        const bodyBuffer = await originalResponse.arrayBuffer();
        return new Response(bodyBuffer, { status, statusText, headers });
    }

    const originalBodyText = await originalResponse.text();
    const nextBodyText = patchBodyText(
        originalBodyText,
        responseBodyStrategy,
        responsePatch.body ?? "",
        responsePatch.jsonPatch ?? {},
    );
    headers.delete("content-length");
    return new Response(nextBodyText, { status, statusText, headers });
}

function patchFetch(): void {
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

function getNativeXhrValue<T>(
    descriptor: PropertyDescriptor | undefined,
    xhr: XMLHttpRequest,
    fallbackValue: T,
): T {
    if (descriptor?.get) {
        return descriptor.get.call(xhr) as T;
    }
    return fallbackValue;
}

function createDefaultSyntheticState(xhr: XMLHttpRequest): SyntheticXhrState {
    return {
        useSynthetic: false,
        readyState: getNativeXhrValue(readyStateDescriptor, xhr, 0),
        status: getNativeXhrValue(statusDescriptor, xhr, 0),
        statusText: getNativeXhrValue(statusTextDescriptor, xhr, ""),
        responseType: getNativeXhrValue(responseTypeDescriptor, xhr, ""),
        responseText: "",
        response: "",
        responseURL: "",
        responseHeaders: new Headers(),
    };
}

function getSyntheticState(xhr: XMLHttpRequest): SyntheticXhrState {
    let state = syntheticXhrStateByInstance.get(xhr);
    if (!state) {
        state = createDefaultSyntheticState(xhr);
        syntheticXhrStateByInstance.set(xhr, state);
    }
    return state;
}

function resetSyntheticState(xhr: XMLHttpRequest): void {
    const state = getSyntheticState(xhr);
    state.useSynthetic = false;
    state.readyState = getNativeXhrValue(readyStateDescriptor, xhr, 0);
    state.status = getNativeXhrValue(statusDescriptor, xhr, 0);
    state.statusText = getNativeXhrValue(statusTextDescriptor, xhr, "");
    state.responseType = getNativeXhrValue(responseTypeDescriptor, xhr, "");
    state.responseText = "";
    state.response = "";
    state.responseURL = "";
    state.responseHeaders = new Headers();
}

function installSyntheticXhrOverrides(xhr: XMLHttpRequest): void {
    if (patchedXhrInstances.has(xhr)) {
        return;
    }

    patchedXhrInstances.add(xhr);

    Object.defineProperties(xhr, {
        readyState: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.readyState;
                }
                return getNativeXhrValue(readyStateDescriptor, xhr, 0);
            },
        },
        status: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.status;
                }
                return getNativeXhrValue(statusDescriptor, xhr, 0);
            },
        },
        statusText: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.statusText;
                }
                return getNativeXhrValue(statusTextDescriptor, xhr, "");
            },
        },
        response: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.response;
                }
                return getNativeXhrValue(responseDescriptor, xhr, null);
            },
        },
        responseText: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.responseText;
                }
                return getNativeXhrValue(responseTextDescriptor, xhr, "");
            },
        },
        responseURL: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.responseURL;
                }
                return getNativeXhrValue(responseURLDescriptor, xhr, "");
            },
        },
        responseType: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.responseType;
                }
                return getNativeXhrValue(responseTypeDescriptor, xhr, "");
            },
            set(value: XMLHttpRequestResponseType) {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    state.responseType = value;
                    return;
                }
                responseTypeDescriptor?.set?.call(xhr, value);
            },
        },
        getResponseHeader: {
            configurable: true,
            value(name: string): string | null {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.responseHeaders.get(name);
                }
                return originalXhrGetResponseHeader.call(xhr, name);
            },
        },
        getAllResponseHeaders: {
            configurable: true,
            value(): string {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return Array.from(state.responseHeaders.entries())
                        .map(([key, value]) => `${key}: ${value}`)
                        .join("\r\n");
                }
                return originalXhrGetAllResponseHeaders.call(xhr);
            },
        },
    });
}

function emitProgressEvent(xhr: XMLHttpRequest, type: string): void {
    xhr.dispatchEvent(new ProgressEvent(type));
}

function emitReadyStateChange(xhr: XMLHttpRequest, nextReadyState: number): void {
    const state = getSyntheticState(xhr);
    state.readyState = nextReadyState;
    emitProgressEvent(xhr, "readystatechange");
}

function emitSyntheticAbort(xhr: XMLHttpRequest): void {
    const state = getSyntheticState(xhr);
    state.useSynthetic = true;
    state.status = 0;
    state.statusText = "";
    state.responseText = "";
    state.response = "";
    state.responseURL = "";
    state.responseHeaders = new Headers();
    emitReadyStateChange(xhr, 4);
    emitProgressEvent(xhr, "abort");
    emitProgressEvent(xhr, "loadend");
}

async function readSyntheticXhrBody(
    response: Response,
    responseType: XMLHttpRequestResponseType,
): Promise<{ response: unknown; responseText: string }> {
    if (responseType === "arraybuffer") {
        return { response: await response.arrayBuffer(), responseText: "" };
    }

    if (responseType === "blob") {
        return { response: await response.blob(), responseText: "" };
    }

    const responseText = await response.text();

    if (responseType === "json") {
        try {
            return {
                response: responseText ? (JSON.parse(responseText) as unknown) : null,
                responseText,
            };
        } catch {
            return { response: null, responseText };
        }
    }

    return { response: responseText, responseText };
}

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

function patchXmlHttpRequest(): void {
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

patchFetch();
patchXmlHttpRequest();
