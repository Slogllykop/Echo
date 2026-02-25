import { useCallback, useEffect, useMemo, useState } from "react";
import { sendRuntimeMessage } from "@/lib/runtime";
import type { EchoRule, RulesListPayload } from "@/lib/types";

export interface UseRulesReturn {
    rules: EchoRule[];
    loading: boolean;
    working: boolean;
    errorMessage: string | null;
    activeRuleCount: number;
    setErrorMessage: (message: string | null) => void;
    syncRules: (
        action:
            | { type: "rules:list" }
            | { type: "rules:upsert"; rule: EchoRule }
            | { type: "rules:delete"; ruleId: string }
            | { type: "rules:toggle"; ruleId: string; enabled: boolean }
            | { type: "rules:reorder"; ruleIds: string[] },
    ) => Promise<void>;
    deleteRuleById: (ruleId: string) => Promise<void>;
    moveRule: (ruleId: string, direction: "up" | "down") => Promise<void>;
    setRuleEnabled: (rule: EchoRule, enabled: boolean) => Promise<void>;
    deleteAllRules: () => Promise<void>;
    extensionEnabled: boolean;
    setExtensionEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    setWorking: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useRules(): UseRulesReturn {
    const [rules, setRules] = useState<EchoRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [extensionEnabled, setExtensionEnabled] = useState(true);

    const activeRuleCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);

    const syncRules = useCallback(
        async (
            action:
                | { type: "rules:list" }
                | { type: "rules:upsert"; rule: EchoRule }
                | { type: "rules:delete"; ruleId: string }
                | { type: "rules:toggle"; ruleId: string; enabled: boolean }
                | { type: "rules:reorder"; ruleIds: string[] },
        ) => {
            setWorking(true);
            setErrorMessage(null);

            const response = await sendRuntimeMessage<RulesListPayload>(action);
            if (!response.ok) {
                setErrorMessage(response.error);
                setWorking(false);
                return;
            }

            setRules(response.data.rules);
            setExtensionEnabled(response.data.extensionEnabled);
            setWorking(false);
        },
        [],
    );

    useEffect(() => {
        void (async () => {
            await syncRules({ type: "rules:list" });
            setLoading(false);
        })();
    }, [syncRules]);

    const deleteRuleById = useCallback(
        async (ruleId: string) => {
            if (!window.confirm("Delete this rule?")) {
                return;
            }
            await syncRules({ type: "rules:delete", ruleId });
        },
        [syncRules],
    );

    const moveRule = useCallback(
        async (ruleId: string, direction: "up" | "down") => {
            const index = rules.findIndex((rule) => rule.id === ruleId);
            if (index < 0) {
                return;
            }

            const targetIndex = direction === "up" ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= rules.length) {
                return;
            }

            const nextOrder = [...rules];
            [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];

            await syncRules({
                type: "rules:reorder",
                ruleIds: nextOrder.map((rule) => rule.id),
            });
        },
        [rules, syncRules],
    );

    const setRuleEnabled = useCallback(
        async (rule: EchoRule, enabled: boolean) => {
            await syncRules({
                type: "rules:toggle",
                ruleId: rule.id,
                enabled,
            });
        },
        [syncRules],
    );

    const deleteAllRules = useCallback(async () => {
        if (!window.confirm(`Delete all ${rules.length} rule(s)?`)) {
            return;
        }

        setWorking(true);
        setErrorMessage(null);

        for (const rule of rules) {
            const response = await sendRuntimeMessage<RulesListPayload>({
                type: "rules:delete",
                ruleId: rule.id,
            });
            if (!response.ok) {
                setErrorMessage(`Failed to delete rule "${rule.name}": ${response.error}`);
                setWorking(false);
                return;
            }
        }

        await syncRules({ type: "rules:list" });
    }, [rules, syncRules]);

    return {
        rules,
        loading,
        working,
        errorMessage,
        activeRuleCount,
        setErrorMessage,
        syncRules,
        deleteRuleById,
        moveRule,
        setRuleEnabled,
        deleteAllRules,
        extensionEnabled,
        setExtensionEnabled,
        setWorking,
    };
}
