import {
    IconBolt,
    IconDownload,
    IconPencil,
    IconPlus,
    IconTrash,
    IconUpload,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface AppHeaderProps {
    loading: boolean;
    working: boolean;
    isEditorOpen: boolean;
    extensionEnabled: boolean;
    activeRuleCount: number;
    rulesCount: number;
    onToggleExtension: (enabled: boolean) => void;
    onCreateRule: () => void;
    onDeleteAll: () => void;
    onImport: () => void;
    onExport: () => void;
    onPreloadEditor: () => void;
}

export function AppHeader({
    loading,
    working,
    isEditorOpen,
    extensionEnabled,
    activeRuleCount,
    rulesCount,
    onToggleExtension,
    onCreateRule,
    onDeleteAll,
    onImport,
    onExport,
    onPreloadEditor,
}: AppHeaderProps) {
    return (
        <header className="border-b z-10 sticky top-0 left-0 right-0 border-border bg-background px-3 py-3">
            <div className="flex flex-col items-start justify-between gap-3">
                <div className="flex justify-between w-full">
                    {/* Logo and tagline section */}
                    <div>
                        <h1 className="flex items-center gap-2 text-base font-semibold tracking-[0.08em] uppercase">
                            <span className="inline-flex size-6 items-center justify-center rounded-sm border border-border bg-muted/40">
                                <img
                                    src="icons/icon32.png"
                                    alt="Echo logo"
                                    className="size-4 rounded-[2px]"
                                />
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
                    <div className="flex items-center">
                        {isEditorOpen ? (
                            <Badge variant="secondary" className="text-primary">
                                <IconPencil />
                                Editing Rule
                            </Badge>
                        ) : loading ? (
                            <Skeleton className="h-7 w-24 rounded-full" />
                        ) : (
                            <div className="flex items-center gap-2.5">
                                <span className="text-xs tracking-[0.08em] text-muted-foreground uppercase font-medium">
                                    Extension
                                </span>
                                <Switch
                                    aria-label="Toggle extension"
                                    checked={extensionEnabled}
                                    disabled={working}
                                    onCheckedChange={(checked) => void onToggleExtension(checked)}
                                    className="scale-110"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Action buttons section */}
                {!isEditorOpen && !loading && (
                    <div className="flex items-center w-full justify-between">
                        <Button
                            size="sm"
                            onClick={onCreateRule}
                            disabled={working}
                            onMouseEnter={onPreloadEditor}
                            onFocus={onPreloadEditor}
                        >
                            <IconPlus />
                            New Rule
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onDeleteAll}
                            disabled={working || rulesCount === 0}
                            title="Delete all rules"
                        >
                            <IconTrash />
                            Delete All
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onImport}
                            disabled={working}
                            title="Import rules from JSON file"
                        >
                            <IconUpload />
                            Import
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onExport}
                            disabled={working || rulesCount === 0}
                            title="Export rules to JSON file"
                        >
                            <IconDownload />
                            Export
                        </Button>
                    </div>
                )}
            </div>
        </header>
    );
}
