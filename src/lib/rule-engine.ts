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

function getUrlCandidates(url: string): string[] {
    const candidates = new Set<string>();
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
        return [];
    }

    candidates.add(trimmedUrl);

    try {
        const parsedUrl = new URL(trimmedUrl, "http://echo.local");
        const pathnameWithSearch = `${parsedUrl.pathname}${parsedUrl.search}`;

        candidates.add(parsedUrl.href);
        candidates.add(pathnameWithSearch);
        candidates.add(parsedUrl.pathname);
    } catch {
        // Keep raw URL only when parsing fails.
    }

    return [...candidates];
}

function matchesByType(type: UrlMatchType, url: string, pattern: string): boolean {
    if (!pattern.trim()) {
        return false;
    }

    const candidates = getUrlCandidates(url);

    switch (type) {
        case "contains":
            return candidates.some((candidate) => candidate.includes(pattern));
        case "exact":
            return candidates.some((candidate) => candidate === pattern);
        case "regex":
            try {
                const regex = new RegExp(pattern);
                return candidates.some((candidate) => regex.test(candidate));
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

export function evaluateRules(rules: EchoRule[], request: InterceptRequest): InterceptDecision {
    const matchingRules = rules
        .filter((rule) => rule.enabled)
        .filter((rule) => isMethodMatch(rule.match.method, request.method))
        .filter((rule) => matchesByType(rule.match.type, request.url, rule.match.pattern))
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
