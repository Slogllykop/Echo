import { Skeleton } from "@/components/ui/skeleton";

const RULE_LOADING_KEYS = ["rule-1", "rule-2", "rule-3"] as const;
const ACTION_LOADING_KEYS = ["action-1", "action-2", "action-3", "action-4", "action-5"] as const;

export function RulesListSkeleton() {
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

export function RuleEditorSkeleton() {
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
