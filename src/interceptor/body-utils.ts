import type {
    BodyPatchStrategy,
    InterceptRequest,
    MockDecision,
    ModifyDecision,
} from "@/lib/types";

export type XhrSendBody = Document | XMLHttpRequestBodyInit | null | undefined;

export function hasRequestBody(method: string): boolean {
    return method !== "GET" && method !== "HEAD";
}

export function headersToRecord(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of headers.entries()) {
        result[key] = value;
    }
    return result;
}

export async function toInterceptRequest(request: Request): Promise<InterceptRequest> {
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

export function applyHeaderPatch(headers: Headers, patch: Record<string, string>): Headers {
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

export function buildMockResponse(decision: MockDecision): Response {
    return new Response(decision.mock.body, {
        status: decision.mock.status,
        statusText: decision.mock.statusText,
        headers: decision.mock.headers,
    });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMerge(
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

export function patchBodyText(
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

export async function createPatchedRequestForModify(
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

export async function applyModifyDecision(
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

export function normalizeXhrBody(body: XhrSendBody): {
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
