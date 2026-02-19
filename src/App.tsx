import {
  IconArrowDown,
  IconArrowsDownUp,
  IconArrowUp,
  IconBolt,
  IconEdit,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { type ComponentType, lazy, Suspense, useEffect, useMemo, useState } from "react";
import { RequestOutcomePreview } from "@/components/request-simulator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { createEmptyRuleDraft, draftToRule, type RuleDraft, ruleToDraft } from "@/lib/rule-form";
import { sendRuntimeMessage } from "@/lib/runtime";
import type { EchoRule, RulesListPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

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

function ruleSummary(rule: EchoRule): string {
  return `${rule.match.method} ${rule.match.type} "${rule.match.pattern}"`;
}

const RULE_LOADING_KEYS = ["rule-1", "rule-2", "rule-3"] as const;
const ACTION_LOADING_KEYS = ["action-1", "action-2", "action-3", "action-4", "action-5"] as const;

function RulesListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {RULE_LOADING_KEYS.map((key) => (
        <div key={key} className="space-y-2 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-56" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {ACTION_LOADING_KEYS.map((actionKey) => (
              <Skeleton key={`${key}-${actionKey}`} className="h-5 w-14 rounded-sm" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RuleEditorSkeleton() {
  return (
    <div className="space-y-3 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-6 w-24" />
      </div>

      <Skeleton className="h-7 w-full" />

      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>

      <Skeleton className="h-7 w-full" />

      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>

      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function App() {
  const [rules, setRules] = useState<EchoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editorDraft, setEditorDraft] = useState<RuleDraft | null>(null);
  const [extensionEnabled, setExtensionEnabled] = useState(true);

  const activeRuleCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);
  const isEditorOpen = editorMode !== null && editorDraft !== null;

  async function syncRules(
    action:
      | { type: "rules:list" }
      | { type: "rules:upsert"; rule: EchoRule }
      | { type: "rules:delete"; ruleId: string }
      | { type: "rules:toggle"; ruleId: string; enabled: boolean }
      | { type: "rules:reorder"; ruleIds: string[] },
  ) {
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
  }

  useEffect(() => {
    void (async () => {
      await syncRules({ type: "rules:list" });
      setLoading(false);
    })();
  }, []);

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

  async function setRuleEnabled(rule: EchoRule, enabled: boolean) {
    await syncRules({
      type: "rules:toggle",
      ruleId: rule.id,
      enabled,
    });
  }

  async function setExtensionPower(enabled: boolean) {
    setWorking(true);
    setErrorMessage(null);

    const response = await sendRuntimeMessage<RulesListPayload>({
      type: "extension:set-enabled",
      enabled,
    });
    if (!response.ok) {
      setErrorMessage(response.error);
      setWorking(false);
      return;
    }

    setRules(response.data.rules);
    setExtensionEnabled(response.data.extensionEnabled);
    setWorking(false);
  }

  async function deleteRuleById(ruleId: string) {
    if (!window.confirm("Delete this rule?")) {
      return;
    }
    await syncRules({ type: "rules:delete", ruleId });
  }

  async function moveRule(ruleId: string, direction: "up" | "down") {
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
  }

  return (
    <div className="flex h-full min-h-[640px] flex-col border border-border bg-background text-foreground">
      <header className="border-b border-border bg-background px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold tracking-[0.08em] uppercase">
              <span className="inline-flex size-6 items-center justify-center rounded-sm border border-border bg-muted/40">
                <img src="icons/icon32.png" alt="Echo logo" className="size-4 rounded-[2px]" />
              </span>
              <span className="text-primary">Echo</span>
              {loading ? (
                <Skeleton className="h-4 w-14 rounded-full" />
              ) : (
                <Badge
                  variant={activeRuleCount > 0 ? "default" : "outline"}
                  className="h-4 gap-1 px-1.5 text-[10px] normal-case"
                >
                  <IconBolt className="size-2.5" />
                  {activeRuleCount} active
                </Badge>
              )}
            </h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Offline API mock and patch engine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditorOpen ? (
              <Badge variant="secondary" className="text-primary">
                <IconPencil />
                Editing Rule
              </Badge>
            ) : loading ? (
              <>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-6 w-20" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                    Extension
                  </span>
                  <Switch
                    aria-label="Toggle extension"
                    checked={extensionEnabled}
                    disabled={working}
                    onCheckedChange={(checked) => void setExtensionPower(checked)}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={openCreateEditor}
                  disabled={working}
                  onMouseEnter={preloadRuleEditor}
                  onFocus={preloadRuleEditor}
                >
                  <IconPlus />
                  New Rule
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {errorMessage && (
        <p className="border-b border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </p>
      )}

      {isEditorOpen && editorDraft && editorMode ? (
        <section className="flex-1">
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
              <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-3 text-center">
                <Badge variant="outline">
                  <IconArrowsDownUp />
                  Rule stack empty
                </Badge>
                <p className="max-w-72 text-xs text-muted-foreground">
                  Create your first rule to intercept matching requests. The most specific match is
                  applied first, then list order.
                </p>
                <Button
                  size="sm"
                  onClick={openCreateEditor}
                  onMouseEnter={preloadRuleEditor}
                  onFocus={preloadRuleEditor}
                >
                  <IconPlus />
                  Create First Rule
                </Button>
              </div>
            ) : (
              rules.map((rule, index) => (
                <article
                  key={rule.id}
                  className={cn(
                    "border-b border-border px-3 py-3 last:border-b-0",
                    extensionEnabled ? "hover:bg-muted/40" : "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3
                        className={
                          rule.enabled
                            ? "text-sm font-medium text-foreground"
                            : "text-sm font-medium text-muted-foreground"
                        }
                      >
                        {rule.name}
                      </h3>
                      <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                        {ruleSummary(rule)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={
                          rule.action.kind === "mock"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        }
                      >
                        {rule.action.kind}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-2 grid w-full grid-cols-6 items-center gap-1">
                    <div className="flex h-8 items-center justify-start">
                      <Switch
                        aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                        checked={rule.enabled}
                        disabled={working || !extensionEnabled}
                        onCheckedChange={(checked) => void setRuleEnabled(rule, checked)}
                      />
                    </div>
                    <div className="flex h-8 items-center justify-center">
                      <span className="text-[11px] text-muted-foreground">
                        {rule.action.delayMs}ms
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6.5 w-full items-center justify-center gap-1.5 text-[12px] leading-none [&_svg]:size-3.5"
                      disabled={!extensionEnabled}
                      onClick={() => openEditEditor(rule)}
                      onMouseEnter={preloadRuleEditor}
                      onFocus={preloadRuleEditor}
                    >
                      <IconEdit />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6.5 w-full items-center justify-center gap-1.5 text-[12px] leading-none [&_svg]:size-3.5"
                      disabled={!extensionEnabled || index === 0}
                      onClick={() => void moveRule(rule.id, "up")}
                    >
                      <IconArrowUp />
                      Up
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6.5 w-full items-center justify-center gap-1.5 text-[12px] leading-none [&_svg]:size-3.5"
                      disabled={!extensionEnabled || index === rules.length - 1}
                      onClick={() => void moveRule(rule.id, "down")}
                    >
                      <IconArrowDown />
                      Down
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6.5 w-full items-center justify-center gap-1.5 px-1.5 text-[12px] leading-none [&_svg]:size-3.5"
                      disabled={!extensionEnabled}
                      onClick={() => void deleteRuleById(rule.id)}
                    >
                      <IconTrash className="text-destructive" />
                      Delete
                    </Button>
                  </div>
                </article>
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
