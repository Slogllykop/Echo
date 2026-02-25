import { readStorageBoolean, writeStorageBoolean } from "@/lib/chrome-storage";
import { deleteRule, listRules, reorderRules, toggleRule, upsertRule } from "@/lib/db";
import { evaluateRules } from "@/lib/rule-engine";
import type {
    ApiResult,
    BackgroundMessage,
    EchoRule,
    EvaluatePayload,
    RulesListPayload,
} from "@/lib/types";

let cachedRules: EchoRule[] | null = null;
let cachedExtensionEnabled: boolean | null = null;
const EXTENSION_ENABLED_KEY = "echo-extension-enabled";

const MESSAGE_TYPES: BackgroundMessage["type"][] = [
    "rules:list",
    "rules:upsert",
    "rules:delete",
    "rules:toggle",
    "rules:reorder",
    "extension:set-enabled",
    "interceptor:evaluate",
    "interceptor:simulate",
];

export function isBackgroundMessage(value: unknown): value is BackgroundMessage {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Partial<BackgroundMessage>;
    return (
        typeof candidate.type === "string" &&
        MESSAGE_TYPES.includes(candidate.type as BackgroundMessage["type"])
    );
}

function ok<T>(data: T): ApiResult<T> {
    return { ok: true, data };
}

export function fail<T>(error: string): ApiResult<T> {
    return { ok: false, error };
}

async function getRules(): Promise<EchoRule[]> {
    if (cachedRules) {
        return cachedRules;
    }
    cachedRules = await listRules();
    return cachedRules;
}

async function refreshRules(): Promise<EchoRule[]> {
    cachedRules = await listRules();
    return cachedRules;
}

async function getExtensionEnabled(): Promise<boolean> {
    if (cachedExtensionEnabled !== null) {
        return cachedExtensionEnabled;
    }

    const storedValue = await readStorageBoolean(EXTENSION_ENABLED_KEY);
    cachedExtensionEnabled = storedValue ?? true;
    return cachedExtensionEnabled;
}

async function setExtensionEnabled(enabled: boolean): Promise<void> {
    await writeStorageBoolean(EXTENSION_ENABLED_KEY, enabled);
    cachedExtensionEnabled = enabled;
}

async function toRulesPayload(rules: EchoRule[]): Promise<RulesListPayload> {
    return {
        rules,
        extensionEnabled: await getExtensionEnabled(),
    };
}

function normalizeRule(rule: EchoRule, existingRules: EchoRule[]): EchoRule {
    const now = Date.now();
    const existingRule = existingRules.find((currentRule) => currentRule.id === rule.id);
    return {
        ...rule,
        order: existingRule ? rule.order : existingRules.length,
        createdAt: existingRule ? existingRule.createdAt : now,
        updatedAt: now,
    };
}

async function handleRulesMessage(
    message: BackgroundMessage,
): Promise<ApiResult<RulesListPayload>> {
    switch (message.type) {
        case "rules:list": {
            const rules = await getRules();
            return ok(await toRulesPayload(rules));
        }
        case "rules:upsert": {
            const existingRules = await getRules();
            const normalizedRule = normalizeRule(message.rule, existingRules);
            await upsertRule(normalizedRule);
            const rules = await refreshRules();
            return ok(await toRulesPayload(rules));
        }
        case "rules:delete": {
            await deleteRule(message.ruleId);
            const rules = await refreshRules();
            return ok(await toRulesPayload(rules));
        }
        case "rules:toggle": {
            const found = await toggleRule(message.ruleId, message.enabled);
            if (!found) {
                return fail("Rule not found.");
            }
            const rules = await refreshRules();
            return ok(await toRulesPayload(rules));
        }
        case "rules:reorder": {
            await reorderRules(message.ruleIds);
            const rules = await refreshRules();
            return ok(await toRulesPayload(rules));
        }
        default:
            return fail("Unsupported rules operation.");
    }
}

async function handleExtensionMessage(
    message: BackgroundMessage,
): Promise<ApiResult<RulesListPayload>> {
    if (message.type !== "extension:set-enabled") {
        return fail("Unsupported extension operation.");
    }

    await setExtensionEnabled(message.enabled);
    const rules = await getRules();
    return ok(await toRulesPayload(rules));
}

async function handleEvaluateMessage(
    message: BackgroundMessage,
): Promise<ApiResult<EvaluatePayload>> {
    if (message.type !== "interceptor:evaluate" && message.type !== "interceptor:simulate") {
        return fail("Unsupported evaluate operation.");
    }

    const extensionEnabled = await getExtensionEnabled();
    if (!extensionEnabled) {
        return ok({
            decision: {
                kind: "pass-through",
                delayMs: 0,
            },
        });
    }

    const rules = await getRules();
    const decision = evaluateRules(rules, message.request);
    return ok({ decision });
}

export async function handleMessage(
    message: BackgroundMessage,
): Promise<ApiResult<RulesListPayload | EvaluatePayload>> {
    if (
        message.type === "rules:list" ||
        message.type === "rules:upsert" ||
        message.type === "rules:delete" ||
        message.type === "rules:toggle" ||
        message.type === "rules:reorder"
    ) {
        return handleRulesMessage(message);
    }

    if (message.type === "extension:set-enabled") {
        return handleExtensionMessage(message);
    }

    if (message.type === "interceptor:evaluate" || message.type === "interceptor:simulate") {
        return handleEvaluateMessage(message);
    }

    return fail("Unknown message received by service worker.");
}
