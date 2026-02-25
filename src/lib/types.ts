export const HTTP_METHODS = [
    "ANY",
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];
export type UrlMatchType = "contains" | "regex" | "exact";
export type RuleActionKind = "mock" | "modify";
export type BodyPatchStrategy = "none" | "replace" | "merge-json";
export type ResponseBodyStrategy = BodyPatchStrategy;

export interface RuleMatchConfig {
    method: HttpMethod;
    type: UrlMatchType;
    pattern: string;
}

export interface MockResponseConfig {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
}

export interface ModifyRequestConfig {
    headers: Record<string, string>;
    bodyStrategy: BodyPatchStrategy;
    body: string;
    jsonPatch: Record<string, unknown>;
}

export interface ModifyResponseConfig {
    status?: number;
    headers: Record<string, string>;
    bodyStrategy: ResponseBodyStrategy;
    body: string;
    jsonPatch: Record<string, unknown>;
}

export interface ModifyResponsePatch {
    request: ModifyRequestConfig;
    response: ModifyResponseConfig;
}

export interface RuleActionConfig {
    kind: RuleActionKind;
    delayMs: number;
    mock: MockResponseConfig;
    modify: ModifyResponsePatch;
}

export interface EchoRule {
    id: string;
    name: string;
    enabled: boolean;
    order: number;
    createdAt: number;
    updatedAt: number;
    match: RuleMatchConfig;
    action: RuleActionConfig;
}

export interface InterceptRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
}

export interface PassThroughDecision {
    kind: "pass-through";
    delayMs: number;
}

export interface MockDecision {
    kind: "mock";
    delayMs: number;
    ruleId: string;
    ruleName: string;
    mock: MockResponseConfig;
}

export interface ModifyDecision {
    kind: "modify";
    delayMs: number;
    ruleId: string;
    ruleName: string;
    modify: ModifyResponsePatch;
}

export type InterceptDecision = PassThroughDecision | MockDecision | ModifyDecision;

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type BackgroundMessage =
    | { type: "rules:list" }
    | { type: "rules:upsert"; rule: EchoRule }
    | { type: "rules:delete"; ruleId: string }
    | { type: "rules:toggle"; ruleId: string; enabled: boolean }
    | { type: "rules:reorder"; ruleIds: string[] }
    | { type: "extension:set-enabled"; enabled: boolean }
    | { type: "interceptor:evaluate"; request: InterceptRequest }
    | { type: "interceptor:simulate"; request: InterceptRequest }
    | { type: "rules:request-sync" };

export interface RulesListPayload {
    rules: EchoRule[];
    extensionEnabled: boolean;
}

export interface EvaluatePayload {
    decision: InterceptDecision;
}

/** Payload pushed from background → content-bridge → page when rules change. */
export interface RulesSyncPayload {
    rules: EchoRule[];
    extensionEnabled: boolean;
}

/** Message sent from background to content scripts when rules/state change. */
export interface RulesPushMessage {
    type: "rules:push";
    payload: RulesSyncPayload;
}

export const ECHO_PAGE_SOURCE = "echo-page";
export const ECHO_BRIDGE_SOURCE = "echo-bridge";
export const ECHO_PAGE_REQUEST_TYPE = "echo:evaluate";
export const ECHO_BRIDGE_RESPONSE_TYPE = "echo:decision";
export const ECHO_RULES_SYNC_TYPE = "echo:rules-sync";

export interface PageEvaluateMessage {
    source: typeof ECHO_PAGE_SOURCE;
    type: typeof ECHO_PAGE_REQUEST_TYPE;
    requestId: string;
    request: InterceptRequest;
}

export interface BridgeDecisionMessage {
    source: typeof ECHO_BRIDGE_SOURCE;
    type: typeof ECHO_BRIDGE_RESPONSE_TYPE;
    requestId: string;
    decision: InterceptDecision;
}

/** Message posted from content-bridge to page with synced rules. */
export interface BridgeRulesSyncMessage {
    source: typeof ECHO_BRIDGE_SOURCE;
    type: typeof ECHO_RULES_SYNC_TYPE;
    payload: RulesSyncPayload;
}
