import { IconArrowsDownUp, IconPlus } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    onCreateRule: () => void;
    onPreloadEditor: () => void;
}

export function EmptyState({ onCreateRule, onPreloadEditor }: EmptyStateProps) {
    return (
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
                onClick={onCreateRule}
                onMouseEnter={onPreloadEditor}
                onFocus={onPreloadEditor}
            >
                <IconPlus />
                Create First Rule
            </Button>
        </div>
    );
}
