import { type ComponentType, lazy, Suspense, useCallback, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { RequestOutcomePreview } from "@/components/request-simulator";
import { EmptyState } from "@/components/rules/empty-state";
import { RuleCard } from "@/components/rules/rule-card";
import { RuleEditorSkeleton, RulesListSkeleton } from "@/components/skeletons";
import { useExtensionPower } from "@/hooks/use-extension-power";
import { useRules } from "@/hooks/use-rules";
import { createEmptyRuleDraft, draftToRule, type RuleDraft, ruleToDraft } from "@/lib/rule-form";
import { exportRulesToFile, importRulesFromFile } from "@/lib/rule-io";
import { sendRuntimeMessage } from "@/lib/runtime";
import type { EchoRule, RulesListPayload } from "@/lib/types";

interface LazyRuleEditorProps {
    mode: "create" | "edit";
    initialDraft: RuleDraft;
    busy: boolean;
    onSave: (draft: RuleDraft) => Promise<void>;
    onCancel: () => void;
}

let ruleEditorModulePromise: Promise<{ default: ComponentType<LazyRuleEditorProps> }> | null = null;

function loadRuleEditorModule() {
    if (ruleEditorModulePromise) {
        return ruleEditorModulePromise;
    }

    ruleEditorModulePromise = import("@/components/rule-editor").then((module) => ({
        default: module.RuleEditor as ComponentType<LazyRuleEditorProps>,
    }));
    return ruleEditorModulePromise;
}

const LazyRuleEditor = lazy(loadRuleEditorModule);

function preloadRuleEditor() {
    void loadRuleEditorModule();
}

function App() {
    const {
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
        setWorking,
    } = useRules();

    const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
    const [editorDraft, setEditorDraft] = useState<RuleDraft | null>(null);
    const isEditorOpen = editorMode !== null && editorDraft !== null;

    const { setExtensionPower } = useExtensionPower({
        setWorking,
        setErrorMessage,
        onSync: useCallback(
            (_data: RulesListPayload) => {
                void syncRules({ type: "rules:list" });
            },
            [syncRules],
        ),
    });

    function openCreateEditor() {
        preloadRuleEditor();
        setEditorMode("create");
        setEditorDraft(createEmptyRuleDraft(rules.length));
        setErrorMessage(null);
    }

    function openEditEditor(rule: EchoRule) {
        preloadRuleEditor();
        setEditorMode("edit");
        setEditorDraft(ruleToDraft(rule));
        setErrorMessage(null);
    }

    function closeEditor() {
        setEditorMode(null);
        setEditorDraft(null);
        setErrorMessage(null);
    }

    async function saveDraft(draft: RuleDraft) {
        const parsed = draftToRule(draft);
        if (!parsed.ok) {
            setErrorMessage(parsed.error);
            return;
        }

        await syncRules({ type: "rules:upsert", rule: parsed.rule });
        closeEditor();
    }

    async function handleImport() {
        const result = await importRulesFromFile();
        if (!result) {
            return;
        }

        if (!result.ok) {
            setErrorMessage(result.error);
            return;
        }

        setWorking(true);
        setErrorMessage(null);

        for (const rule of result.rules) {
            const response = await sendRuntimeMessage<RulesListPayload>({
                type: "rules:upsert",
                rule,
            });
            if (!response.ok) {
                setErrorMessage(`Failed to import rule "${rule.name}": ${response.error}`);
                setWorking(false);
                return;
            }
        }

        await syncRules({ type: "rules:list" });
    }

    return (
        <div className="flex h-full relative min-h-[600px] flex-col border border-border bg-background text-foreground">
            <AppHeader
                loading={loading}
                working={working}
                isEditorOpen={isEditorOpen}
                extensionEnabled={extensionEnabled}
                activeRuleCount={activeRuleCount}
                rulesCount={rules.length}
                onToggleExtension={setExtensionPower}
                onCreateRule={openCreateEditor}
                onDeleteAll={deleteAllRules}
                onImport={() => void handleImport()}
                onExport={() => exportRulesToFile(rules)}
                onPreloadEditor={preloadRuleEditor}
            />

            {errorMessage && (
                <p className="border-b border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {errorMessage}
                </p>
            )}

            {isEditorOpen && editorDraft && editorMode ? (
                <section className="flex-1 w-screen">
                    <Suspense fallback={<RuleEditorSkeleton />}>
                        <LazyRuleEditor
                            mode={editorMode}
                            initialDraft={editorDraft}
                            busy={working}
                            onSave={saveDraft}
                            onCancel={closeEditor}
                        />
                    </Suspense>
                </section>
            ) : (
                <>
                    <section className="flex-1 overflow-y-auto">
                        {loading ? (
                            <RulesListSkeleton />
                        ) : rules.length === 0 ? (
                            <EmptyState
                                onCreateRule={openCreateEditor}
                                onPreloadEditor={preloadRuleEditor}
                            />
                        ) : (
                            rules.map((rule, index) => (
                                <RuleCard
                                    key={rule.id}
                                    rule={rule}
                                    index={index}
                                    totalRules={rules.length}
                                    working={working}
                                    extensionEnabled={extensionEnabled}
                                    onEdit={openEditEditor}
                                    onToggle={setRuleEnabled}
                                    onMove={moveRule}
                                    onDelete={deleteRuleById}
                                    onPreloadEditor={preloadRuleEditor}
                                />
                            ))
                        )}
                    </section>

                    <RequestOutcomePreview />
                </>
            )}
        </div>
    );
}

export default App;
