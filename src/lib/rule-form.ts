import type {
    BodyPatchStrategy,
    EchoRule,
    HttpMethod,
    ResponseBodyStrategy,
    RuleActionKind,
    UrlMatchType,
} from "@/lib/types";

export interface HeaderFieldDraft {
    id: string;
    key: string;
    value: string;
}

export type BodyLanguage = "json" | "text";

export interface RuleDraft {
    id: string;
    name: string;
    enabled: boolean;
    order: number;
    createdAt: number;
    matchMethod: HttpMethod;
    matchType: UrlMatchType;
    matchPattern: string;
    actionKind: RuleActionKind;
    delayMs: string;
    mockStatus: string;
    mockStatusText: string;
    mockHeaders: HeaderFieldDraft[];
    mockBody: string;
    mockBodyLanguage: BodyLanguage;
    modifyRequestHeaders: HeaderFieldDraft[];
    modifyRequestBodyStrategy: BodyPatchStrategy;
    modifyRequestBody: string;
    modifyRequestBodyLanguage: BodyLanguage;
    modifyRequestJsonPatch: string;
    modifyResponseHeaders: HeaderFieldDraft[];
    modifyResponseStatus: string;
    modifyBodyStrategy: ResponseBodyStrategy;
    modifyBody: string;
    modifyBodyLanguage: BodyLanguage;
    modifyJsonPatch: string;
}

function createHeaderFieldDraft(key = "", value = ""): HeaderFieldDraft {
    return {
        id: crypto.randomUUID(),
        key,
        value,
    };
}

function headersToDraftEntries(headers: Record<string, string>): HeaderFieldDraft[] {
    const entries = Object.entries(headers).map(([key, value]) =>
        createHeaderFieldDraft(key, value),
    );
    return entries.length === 0 ? [createHeaderFieldDraft()] : entries;
}

function headerEntriesToRecord(
    entries: HeaderFieldDraft[],
): { ok: true; headers: Record<string, string> } | { ok: false; error: string } {
    const headers: Record<string, string> = {};

    for (const entry of entries) {
        const key = entry.key.trim();
        const value = entry.value.trim();

        if (!key && !value) {
            continue;
        }

        if (!key) {
            return { ok: false, error: "Header key is required when a value is provided." };
        }

        headers[key] = value;
    }

    return { ok: true, headers };
}

function detectBodyLanguage(body: string, contentType?: string): BodyLanguage {
    if (contentType?.toLowerCase().includes("json")) {
        return "json";
    }

    if (!body.trim()) {
        return "json";
    }

    try {
        JSON.parse(body);
        return "json";
    } catch {
        return "text";
    }
}

export function createEmptyRuleDraft(order: number): RuleDraft {
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        name: `Rule ${order + 1}`,
        enabled: true,
        order,
        createdAt: now,
        matchMethod: "ANY",
        matchType: "contains",
        matchPattern: "/api",
        actionKind: "mock",
        delayMs: "0",
        mockStatus: "200",
        mockStatusText: "OK",
        mockHeaders: [createHeaderFieldDraft("content-type", "application/json")],
        mockBody: '{ "ok": true, "source": "echo" }',
        mockBodyLanguage: "json",
        modifyRequestHeaders: [createHeaderFieldDraft()],
        modifyRequestBodyStrategy: "none",
        modifyRequestBody: "",
        modifyRequestBodyLanguage: "json",
        modifyRequestJsonPatch: "{}",
        modifyResponseHeaders: [createHeaderFieldDraft()],
        modifyResponseStatus: "",
        modifyBodyStrategy: "none",
        modifyBody: "",
        modifyBodyLanguage: "json",
        modifyJsonPatch: "{}",
    };
}

export function ruleToDraft(rule: EchoRule): RuleDraft {
    const requestPatch = rule.action.modify.request;
    const responsePatch = rule.action.modify.response;
    const requestBodyStrategy = requestPatch.bodyStrategy ?? "none";
    const requestBody = requestPatch.body ?? "";
    const requestJsonPatch = requestPatch.jsonPatch ?? {};
    const responseBody = responsePatch.body ?? "";
    const responseJsonPatch = responsePatch.jsonPatch ?? {};

    return {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        order: rule.order,
        createdAt: rule.createdAt,
        matchMethod: rule.match.method,
        matchType: rule.match.type,
        matchPattern: rule.match.pattern,
        actionKind: rule.action.kind,
        delayMs: String(rule.action.delayMs),
        mockStatus: String(rule.action.mock.status),
        mockStatusText: rule.action.mock.statusText,
        mockHeaders: headersToDraftEntries(rule.action.mock.headers),
        mockBody: rule.action.mock.body,
        mockBodyLanguage: detectBodyLanguage(
            rule.action.mock.body,
            rule.action.mock.headers["content-type"],
        ),
        modifyRequestHeaders: headersToDraftEntries(requestPatch.headers ?? {}),
        modifyRequestBodyStrategy: requestBodyStrategy,
        modifyRequestBody: requestBody,
        modifyRequestBodyLanguage: detectBodyLanguage(
            requestBody,
            requestPatch.headers?.["content-type"],
        ),
        modifyRequestJsonPatch: JSON.stringify(requestJsonPatch, null, 2),
        modifyResponseHeaders: headersToDraftEntries(responsePatch.headers ?? {}),
        modifyResponseStatus:
            responsePatch.status === undefined ? "" : String(responsePatch.status),
        modifyBodyStrategy: responsePatch.bodyStrategy ?? "none",
        modifyBody: responseBody,
        modifyBodyLanguage: detectBodyLanguage(
            responseBody,
            responsePatch.headers?.["content-type"],
        ),
        modifyJsonPatch: JSON.stringify(responseJsonPatch, null, 2),
    };
}

export function draftToRule(
    draft: RuleDraft,
): { ok: true; rule: EchoRule } | { ok: false; error: string } {
    if (!draft.name.trim()) {
        return { ok: false, error: "Rule name is required." };
    }

    if (!draft.matchPattern.trim()) {
        return { ok: false, error: "URL pattern is required." };
    }

    const delayMs = Number.parseInt(draft.delayMs, 10);
    if (Number.isNaN(delayMs) || delayMs < 0) {
        return { ok: false, error: "Delay must be a non-negative integer." };
    }

    const mockStatus = Number.parseInt(draft.mockStatus, 10);
    if (Number.isNaN(mockStatus) || mockStatus < 100 || mockStatus > 599) {
        return { ok: false, error: "Mock status code must be between 100 and 599." };
    }

    const mockHeadersResult = headerEntriesToRecord(draft.mockHeaders);
    if (!mockHeadersResult.ok) {
        return mockHeadersResult;
    }

    const modifyRequestHeadersResult = headerEntriesToRecord(draft.modifyRequestHeaders);
    if (!modifyRequestHeadersResult.ok) {
        return modifyRequestHeadersResult;
    }

    const modifyResponseHeadersResult = headerEntriesToRecord(draft.modifyResponseHeaders);
    if (!modifyResponseHeadersResult.ok) {
        return modifyResponseHeadersResult;
    }

    let modifyStatus: number | undefined;
    if (draft.modifyResponseStatus.trim()) {
        const parsedStatus = Number.parseInt(draft.modifyResponseStatus, 10);
        if (Number.isNaN(parsedStatus) || parsedStatus < 100 || parsedStatus > 599) {
            return { ok: false, error: "Modified response status must be between 100 and 599." };
        }
        modifyStatus = parsedStatus;
    }

    let requestJsonPatch: Record<string, unknown> = {};
    if (draft.modifyRequestBodyStrategy === "merge-json") {
        try {
            const parsedJson = JSON.parse(draft.modifyRequestJsonPatch || "{}") as unknown;
            if (
                typeof parsedJson !== "object" ||
                parsedJson === null ||
                Array.isArray(parsedJson)
            ) {
                return {
                    ok: false,
                    error: "Request JSON patch must be a JSON object when merge-json strategy is selected.",
                };
            }
            requestJsonPatch = parsedJson as Record<string, unknown>;
        } catch {
            return {
                ok: false,
                error: "Invalid request JSON patch. Please provide a valid JSON object.",
            };
        }
    }

    let jsonPatch: Record<string, unknown> = {};
    if (draft.modifyBodyStrategy === "merge-json") {
        try {
            const parsedJson = JSON.parse(draft.modifyJsonPatch || "{}") as unknown;
            if (
                typeof parsedJson !== "object" ||
                parsedJson === null ||
                Array.isArray(parsedJson)
            ) {
                return {
                    ok: false,
                    error: "JSON patch must be a JSON object when merge-json strategy is selected.",
                };
            }
            jsonPatch = parsedJson as Record<string, unknown>;
        } catch {
            return { ok: false, error: "Invalid JSON patch. Please provide a valid JSON object." };
        }
    }

    const now = Date.now();

    return {
        ok: true,
        rule: {
            id: draft.id,
            name: draft.name.trim(),
            enabled: draft.enabled,
            order: draft.order,
            createdAt: draft.createdAt,
            updatedAt: now,
            match: {
                method: draft.matchMethod,
                type: draft.matchType,
                pattern: draft.matchPattern.trim(),
            },
            action: {
                kind: draft.actionKind,
                delayMs,
                mock: {
                    status: mockStatus,
                    statusText: draft.mockStatusText || "OK",
                    headers: mockHeadersResult.headers,
                    body: draft.mockBody,
                },
                modify: {
                    request: {
                        headers: modifyRequestHeadersResult.headers,
                        bodyStrategy: draft.modifyRequestBodyStrategy,
                        body: draft.modifyRequestBody,
                        jsonPatch: requestJsonPatch,
                    },
                    response: {
                        status: modifyStatus,
                        headers: modifyResponseHeadersResult.headers,
                        bodyStrategy: draft.modifyBodyStrategy,
                        body: draft.modifyBody,
                        jsonPatch,
                    },
                },
            },
        },
    };
}
