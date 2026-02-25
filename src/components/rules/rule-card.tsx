import { IconArrowDown, IconArrowUp, IconEdit, IconTrash } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { EchoRule } from "@/lib/types";
import { cn } from "@/lib/utils";

function ruleSummary(rule: EchoRule): string {
    return `${rule.match.method} ${rule.match.type} "${rule.match.pattern}"`;
}

interface RuleCardProps {
    rule: EchoRule;
    index: number;
    totalRules: number;
    working: boolean;
    extensionEnabled: boolean;
    onEdit: (rule: EchoRule) => void;
    onToggle: (rule: EchoRule, enabled: boolean) => void;
    onMove: (ruleId: string, direction: "up" | "down") => void;
    onDelete: (ruleId: string) => void;
    onPreloadEditor: () => void;
}

export function RuleCard({
    rule,
    index,
    totalRules,
    working,
    extensionEnabled,
    onEdit,
    onToggle,
    onMove,
    onDelete,
    onPreloadEditor,
}: RuleCardProps) {
    return (
        <article
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
                        onCheckedChange={(checked) => void onToggle(rule, checked)}
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
                    onClick={() => onEdit(rule)}
                    onMouseEnter={onPreloadEditor}
                    onFocus={onPreloadEditor}
                >
                    <IconEdit />
                    Edit
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6.5 w-full items-center justify-center gap-1.5 text-[12px] leading-none [&_svg]:size-3.5"
                    disabled={!extensionEnabled || index === 0}
                    onClick={() => void onMove(rule.id, "up")}
                >
                    <IconArrowUp />
                    Up
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6.5 w-full items-center justify-center gap-1.5 text-[12px] leading-none [&_svg]:size-3.5"
                    disabled={!extensionEnabled || index === totalRules - 1}
                    onClick={() => void onMove(rule.id, "down")}
                >
                    <IconArrowDown />
                    Down
                </Button>
                <Button
                    size="sm"
                    variant="destructive"
                    className="h-6.5 w-full items-center justify-center gap-1.5 px-1.5 text-[12px] leading-none [&_svg]:size-3.5"
                    disabled={!extensionEnabled}
                    onClick={() => void onDelete(rule.id)}
                >
                    <IconTrash className="text-destructive" />
                    Delete
                </Button>
            </div>
        </article>
    );
}
