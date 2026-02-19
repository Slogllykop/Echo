import type { EchoRule, InterceptDecision, InterceptRequest, UrlMatchType } from "@/lib/types";

function normalizeMethod(method: string): string {
    return method.trim().toUpperCase();
}

function isMethodMatch(ruleMethod: string, requestMethod: string): boolean {
    if (ruleMethod === "ANY") {
        return true;
    }
    return normalizeMethod(ruleMethod) === normalizeMethod(requestMethod);
}

function matchesByType(type: UrlMatchType, url: string, pattern: string): boolean {
    if (!pattern.trim()) {
        return false;
    }

    switch (type) {
        case "contains":
            return url.includes(pattern);
        case "exact":
            return url === pattern;
        case "regex":
            try {
                return new RegExp(pattern).test(url);
            } catch {
                return false;
            }
        default:
            return false;
    }
}

function matchSpecificity(rule: EchoRule): number {
    const methodBonus = rule.match.method === "ANY" ? 0 : 25;
    const patternWeight = rule.match.pattern.length;

    switch (rule.match.type) {
        case "exact":
            return 300 + methodBonus + patternWeight;
        case "regex":
            return 200 + methodBonus + patternWeight;
        case "contains":
            return 100 + methodBonus + patternWeight;
        default:
            return methodBonus + patternWeight;
    }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSubsetMatch(expected: unknown, actual: unknown): boolean {
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || expected.length !== actual.length) {
            return false;
        }

        return expected.every((expectedItem, index) => isSubsetMatch(expectedItem, actual[index]));
    }

    if (isPlainObject(expected)) {
        if (!isPlainObject(actual)) {
            return false;
        }

        return Object.entries(expected).every(([key, expectedValue]) =>
            isSubsetMatch(expectedValue, actual[key]),
        );
    }

    return Object.is(expected, actual);
}

function isMockRequestBodyMatch(rule: EchoRule, request: InterceptRequest): boolean {
    if (rule.action.kind !== "mock") {
        return true;
    }

    const requestBodyRule = rule.action.modify.request;
    const strategy = requestBodyRule.bodyStrategy ?? "none";

    if (strategy === "none") {
        return true;
    }

    const incomingBody = request.body ?? "";

    if (strategy === "replace") {
        return incomingBody === (requestBodyRule.body ?? "");
    }

    try {
        const incomingJson = JSON.parse(incomingBody) as unknown;
        return isSubsetMatch(requestBodyRule.jsonPatch ?? {}, incomingJson);
    } catch {
        return false;
    }
}

export function evaluateRules(rules: EchoRule[], request: InterceptRequest): InterceptDecision {
    const matchingRules = rules
        .filter((rule) => rule.enabled)
        .filter((rule) => isMethodMatch(rule.match.method, request.method))
        .filter((rule) => matchesByType(rule.match.type, request.url, rule.match.pattern))
        .filter((rule) => isMockRequestBodyMatch(rule, request))
        .sort((firstRule, secondRule) => {
            const specificityDelta = matchSpecificity(secondRule) - matchSpecificity(firstRule);
            if (specificityDelta !== 0) {
                return specificityDelta;
            }
            return firstRule.order - secondRule.order;
        });

    const winner = matchingRules[0];

    if (!winner) {
        return {
            kind: "pass-through",
            delayMs: 0,
        };
    }

    if (winner.action.kind === "mock") {
        return {
            kind: "mock",
            delayMs: winner.action.delayMs,
            ruleId: winner.id,
            ruleName: winner.name,
            mock: winner.action.mock,
        };
    }

    return {
        kind: "modify",
        delayMs: winner.action.delayMs,
        ruleId: winner.id,
        ruleName: winner.name,
        modify: winner.action.modify,
    };
}
