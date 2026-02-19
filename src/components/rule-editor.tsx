import { IconBolt, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { CodeEditor, preloadCodeEditor } from "@/components/code-editor";
import { HeaderFieldsEditor } from "@/components/header-fields-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RuleDraft } from "@/lib/rule-form";
import type {
    BodyPatchStrategy,
    HttpMethod,
    ResponseBodyStrategy,
    RuleActionKind,
    UrlMatchType,
} from "@/lib/types";

interface RuleEditorProps {
    mode: "create" | "edit";
    initialDraft: RuleDraft;
    busy: boolean;
    onSave: (draft: RuleDraft) => Promise<void>;
    onCancel: () => void;
}

const HTTP_METHOD_OPTIONS: HttpMethod[] = [
    "ANY",
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
];

const MATCH_TYPE_OPTIONS: UrlMatchType[] = ["contains", "regex", "exact"];
const ACTION_KIND_OPTIONS: RuleActionKind[] = ["mock", "modify"];
const BODY_STRATEGY_OPTIONS: BodyPatchStrategy[] = ["none", "replace", "merge-json"];

function RuleEditor({ mode, initialDraft, busy, onSave, onCancel }: RuleEditorProps) {
    const [draft, setDraft] = useState<RuleDraft>(initialDraft);
    const [editorError, setEditorError] = useState<string | null>(null);

    useEffect(() => {
        setDraft(initialDraft);
        setEditorError(null);
    }, [initialDraft]);

    useEffect(() => {
        preloadCodeEditor();
    }, []);

    function formatJsonField(rawValue: string, onApply: (value: string) => void): void {
        try {
            const formatted = JSON.stringify(JSON.parse(rawValue || "{}"), null, 2);
            onApply(formatted);
            setEditorError(null);
        } catch {
            setEditorError("JSON format failed. Please provide valid JSON.");
        }
    }

    function renderBodyStrategySelect(
        value: BodyPatchStrategy | ResponseBodyStrategy,
        onValueChange: (next: BodyPatchStrategy) => void,
        label = "Body Strategy",
    ) {
        return (
            <div className="space-y-1">
                <Label>{label}</Label>
                <Select
                    value={value}
                    onValueChange={(next) => onValueChange(next as BodyPatchStrategy)}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {BODY_STRATEGY_OPTIONS.map((bodyStrategy) => (
                            <SelectItem key={bodyStrategy} value={bodyStrategy}>
                                {bodyStrategy}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    }

    return (
        <form
            className="flex h-full flex-col bg-background px-3 py-3"
            onSubmit={(event) => {
                event.preventDefault();
                void onSave(draft);
            }}
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-primary">
                    {mode === "create" ? "Create Rule" : "Edit Rule"}
                </h2>
                <Button
                    type="button"
                    variant={draft.enabled ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                        setDraft((currentDraft) => ({
                            ...currentDraft,
                            enabled: !currentDraft.enabled,
                        }))
                    }
                >
                    <IconBolt />
                    {draft.enabled ? "Enabled" : "Disabled"}
                </Button>
            </div>

            <div className="space-y-3 pr-0.5">
                <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 space-y-1">
                        <Label htmlFor="rule-name">Rule Name</Label>
                        <Input
                            id="rule-name"
                            value={draft.name}
                            onChange={(event) =>
                                setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    name: event.target.value,
                                }))
                            }
                            placeholder="Users Create Mock"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <Label>Method</Label>
                        <Select
                            value={draft.matchMethod}
                            onValueChange={(value) =>
                                setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    matchMethod: value as HttpMethod,
                                }))
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {HTTP_METHOD_OPTIONS.map((method) => (
                                    <SelectItem key={method} value={method}>
                                        {method}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label>Match Type</Label>
                        <Select
                            value={draft.matchType}
                            onValueChange={(value) =>
                                setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    matchType: value as UrlMatchType,
                                }))
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MATCH_TYPE_OPTIONS.map((matchType) => (
                                    <SelectItem key={matchType} value={matchType}>
                                        {matchType}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="match-pattern">URL Pattern</Label>
                    <Input
                        id="match-pattern"
                        value={draft.matchPattern}
                        onChange={(event) =>
                            setDraft((currentDraft) => ({
                                ...currentDraft,
                                matchPattern: event.target.value,
                            }))
                        }
                        placeholder="/api/v1/users"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label>Action</Label>
                        <Select
                            value={draft.actionKind}
                            onValueChange={(value) =>
                                setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    actionKind: value as RuleActionKind,
                                }))
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ACTION_KIND_OPTIONS.map((actionKind) => (
                                    <SelectItem key={actionKind} value={actionKind}>
                                        {actionKind}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="delay-ms">Delay (ms)</Label>
                        <Input
                            id="delay-ms"
                            inputMode="numeric"
                            value={draft.delayMs}
                            onChange={(event) =>
                                setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    delayMs: event.target.value,
                                }))
                            }
                        />
                    </div>
                </div>

                {draft.actionKind === "mock" && (
                    <div className="space-y-3 border border-border bg-muted/20 p-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="mock-status">Status</Label>
                                <Input
                                    id="mock-status"
                                    inputMode="numeric"
                                    value={draft.mockStatus}
                                    onChange={(event) =>
                                        setDraft((currentDraft) => ({
                                            ...currentDraft,
                                            mockStatus: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="mock-status-text">Status Text</Label>
                                <Input
                                    id="mock-status-text"
                                    value={draft.mockStatusText}
                                    onChange={(event) =>
                                        setDraft((currentDraft) => ({
                                            ...currentDraft,
                                            mockStatusText: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground uppercase">
                                Request
                            </p>
                            <Tabs defaultValue="mock-request-headers">
                                <TabsList>
                                    <TabsTrigger value="mock-request-headers">
                                        Request Headers
                                    </TabsTrigger>
                                    <TabsTrigger value="mock-request-body">
                                        Request Body
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="mock-request-headers">
                                    <HeaderFieldsEditor
                                        id="mock-request-headers"
                                        label="Request Header Patch"
                                        fields={draft.modifyRequestHeaders}
                                        onChange={(fields) =>
                                            setDraft((currentDraft) => ({
                                                ...currentDraft,
                                                modifyRequestHeaders: fields,
                                            }))
                                        }
                                    />
                                </TabsContent>
                                <TabsContent value="mock-request-body">
                                    {renderBodyStrategySelect(
                                        draft.modifyRequestBodyStrategy,
                                        (next) =>
                                            setDraft((currentDraft) => ({
                                                ...currentDraft,
                                                modifyRequestBodyStrategy: next,
                                            })),
                                        "Body Match Strategy",
                                    )}

                                    {draft.modifyRequestBodyStrategy === "replace" && (
                                        <CodeEditor
                                            id="mock-request-body"
                                            label="Expected Request Body (Exact Match)"
                                            value={draft.modifyRequestBody}
                                            language={draft.modifyRequestBodyLanguage}
                                            onChange={(value) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    modifyRequestBody: value,
                                                }))
                                            }
                                            onLanguageChange={(language) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    modifyRequestBodyLanguage: language,
                                                }))
                                            }
                                            onFormatJson={() =>
                                                formatJsonField(
                                                    draft.modifyRequestBody,
                                                    (formatted) =>
                                                        setDraft((currentDraft) => ({
                                                            ...currentDraft,
                                                            modifyRequestBody: formatted,
                                                            modifyRequestBodyLanguage: "json",
                                                        })),
                                                )
                                            }
                                        />
                                    )}

                                    {draft.modifyRequestBodyStrategy === "merge-json" && (
                                        <CodeEditor
                                            id="mock-request-json-patch"
                                            label="Expected Request JSON (Partial Match)"
                                            value={draft.modifyRequestJsonPatch}
                                            language="json"
                                            allowLanguageSwitch={false}
                                            onChange={(value) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    modifyRequestJsonPatch: value,
                                                }))
                                            }
                                            onLanguageChange={() => {}}
                                            onFormatJson={() =>
                                                formatJsonField(
                                                    draft.modifyRequestJsonPatch,
                                                    (formatted) =>
                                                        setDraft((currentDraft) => ({
                                                            ...currentDraft,
                                                            modifyRequestJsonPatch: formatted,
                                                        })),
                                                )
                                            }
                                        />
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground uppercase">
                                Response
                            </p>
                            <Tabs defaultValue="mock-response-headers">
                                <TabsList>
                                    <TabsTrigger value="mock-response-headers">
                                        Response Headers
                                    </TabsTrigger>
                                    <TabsTrigger value="mock-response-body">
                                        Response Body
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="mock-response-headers">
                                    <HeaderFieldsEditor
                                        id="mock-headers"
                                        label="Response Headers"
                                        fields={draft.mockHeaders}
                                        onChange={(fields) =>
                                            setDraft((currentDraft) => ({
                                                ...currentDraft,
                                                mockHeaders: fields,
                                            }))
                                        }
                                    />
                                </TabsContent>
                                <TabsContent value="mock-response-body">
                                    <CodeEditor
                                        id="mock-body"
                                        label="Response Body"
                                        value={draft.mockBody}
                                        language={draft.mockBodyLanguage}
                                        onChange={(value) =>
                                            setDraft((currentDraft) => ({
                                                ...currentDraft,
                                                mockBody: value,
                                            }))
                                        }
                                        onLanguageChange={(language) =>
                                            setDraft((currentDraft) => ({
                                                ...currentDraft,
                                                mockBodyLanguage: language,
                                            }))
                                        }
                                        onFormatJson={() =>
                                            formatJsonField(draft.mockBody, (formatted) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    mockBody: formatted,
                                                    mockBodyLanguage: "json",
                                                })),
                                            )
                                        }
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                )}

                {draft.actionKind === "modify" && (
                    <div className="space-y-3 border border-border bg-muted/20 p-2">
                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground uppercase">
                                Request
                            </p>
                            <Tabs defaultValue="modify-request-headers">
                                <TabsList>
                                    <TabsTrigger value="modify-request-headers">
                                        Request Headers
                                    </TabsTrigger>
                                    <TabsTrigger value="modify-request-body">
                                        Request Body
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="modify-request-headers">
                                    <HeaderFieldsEditor
                                        id="modify-request-headers"
                                        label="Request Header Patch"
                                        fields={draft.modifyRequestHeaders}
                                        onChange={(fields) =>
                                            setDraft((currentDraft) => ({
                                                ...currentDraft,
                                                modifyRequestHeaders: fields,
                                            }))
                                        }
                                    />
                                </TabsContent>
                                <TabsContent value="modify-request-body">
                                    {renderBodyStrategySelect(
                                        draft.modifyRequestBodyStrategy,
                                        (next) =>
                                            setDraft((currentDraft) => ({
                                                ...currentDraft,
                                                modifyRequestBodyStrategy: next,
                                            })),
                                    )}

                                    {draft.modifyRequestBodyStrategy === "replace" && (
                                        <CodeEditor
                                            id="modify-request-body"
                                            label="Request Body Replacement"
                                            value={draft.modifyRequestBody}
                                            language={draft.modifyRequestBodyLanguage}
                                            onChange={(value) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    modifyRequestBody: value,
                                                }))
                                            }
                                            onLanguageChange={(language) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    modifyRequestBodyLanguage: language,
                                                }))
                                            }
                                            onFormatJson={() =>
                                                formatJsonField(
                                                    draft.modifyRequestBody,
                                                    (formatted) =>
                                                        setDraft((currentDraft) => ({
                                                            ...currentDraft,
                                                            modifyRequestBody: formatted,
                                                            modifyRequestBodyLanguage: "json",
                                                        })),
                                                )
                                            }
                                        />
                                    )}

                                    {draft.modifyRequestBodyStrategy === "merge-json" && (
                                        <CodeEditor
                                            id="modify-request-json-patch"
                                            label="Request JSON Patch Object"
                                            value={draft.modifyRequestJsonPatch}
                                            language="json"
                                            allowLanguageSwitch={false}
                                            onChange={(value) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    modifyRequestJsonPatch: value,
                                                }))
                                            }
                                            onLanguageChange={() => {}}
                                            onFormatJson={() =>
                                                formatJsonField(
                                                    draft.modifyRequestJsonPatch,
                                                    (formatted) =>
                                                        setDraft((currentDraft) => ({
                                                            ...currentDraft,
                                                            modifyRequestJsonPatch: formatted,
                                                        })),
                                                )
                                            }
                                        />
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground uppercase">
                                Response
                            </p>
                            <div className="space-y-1">
                                <Label htmlFor="modify-status">Override Status</Label>
                                <Input
                                    id="modify-status"
                                    inputMode="numeric"
                                    placeholder="Leave empty to keep original"
                                    value={draft.modifyResponseStatus}
                                    onChange={(event) =>
                                        setDraft((currentDraft) => ({
                                            ...currentDraft,
                                            modifyResponseStatus: event.target.value,
                                        }))
                                    }
                                />
                            </div>

                            <Tabs defaultValue="modify-response-headers">
                                <TabsList>
                                    <TabsTrigger value="modify-response-headers">
                                        Response Headers
                                    </TabsTrigger>
                                    <TabsTrigger value="modify-response-body">
                                        Response Body
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="modify-response-headers">
                                    <HeaderFieldsEditor
                                        id="modify-response-headers"
                                        label="Response Header Patch"
                                        fields={draft.modifyResponseHeaders}
                                        onChange={(fields) =>
                                            setDraft((currentDraft) => ({
                                                ...currentDraft,
                                                modifyResponseHeaders: fields,
                                            }))
                                        }
                                    />
                                </TabsContent>
                                <TabsContent value="modify-response-body">
                                    {renderBodyStrategySelect(draft.modifyBodyStrategy, (next) =>
                                        setDraft((currentDraft) => ({
                                            ...currentDraft,
                                            modifyBodyStrategy: next as ResponseBodyStrategy,
                                        })),
                                    )}

                                    {draft.modifyBodyStrategy === "replace" && (
                                        <CodeEditor
                                            id="modify-body"
                                            label="Response Body Replacement"
                                            value={draft.modifyBody}
                                            language={draft.modifyBodyLanguage}
                                            onChange={(value) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    modifyBody: value,
                                                }))
                                            }
                                            onLanguageChange={(language) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    modifyBodyLanguage: language,
                                                }))
                                            }
                                            onFormatJson={() =>
                                                formatJsonField(draft.modifyBody, (formatted) =>
                                                    setDraft((currentDraft) => ({
                                                        ...currentDraft,
                                                        modifyBody: formatted,
                                                        modifyBodyLanguage: "json",
                                                    })),
                                                )
                                            }
                                        />
                                    )}

                                    {draft.modifyBodyStrategy === "merge-json" && (
                                        <CodeEditor
                                            id="modify-json-patch"
                                            label="Response JSON Patch Object"
                                            value={draft.modifyJsonPatch}
                                            language="json"
                                            allowLanguageSwitch={false}
                                            onChange={(value) =>
                                                setDraft((currentDraft) => ({
                                                    ...currentDraft,
                                                    modifyJsonPatch: value,
                                                }))
                                            }
                                            onLanguageChange={() => {}}
                                            onFormatJson={() =>
                                                formatJsonField(
                                                    draft.modifyJsonPatch,
                                                    (formatted) =>
                                                        setDraft((currentDraft) => ({
                                                            ...currentDraft,
                                                            modifyJsonPatch: formatted,
                                                        })),
                                                )
                                            }
                                        />
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                )}

                {editorError && <p className="text-xs text-destructive">{editorError}</p>}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
                <Button type="button" variant="outline" onClick={onCancel}>
                    <IconX />
                    Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                    <IconDeviceFloppy />
                    {busy ? "Saving..." : mode === "create" ? "Create Rule" : "Save Rule"}
                </Button>
            </div>
        </form>
    );
}

export { RuleEditor };
