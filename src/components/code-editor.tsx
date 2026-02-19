import { type ComponentType, lazy, Suspense } from "react";
import type { CodeEditorProps } from "@/components/code-editor-impl";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

let editorModulePromise: Promise<{ default: ComponentType<CodeEditorProps> }> | null = null;

function loadEditorModule() {
    if (editorModulePromise) {
        return editorModulePromise;
    }

    editorModulePromise = import("./code-editor-impl").then((module) => ({
        default: module.default,
    }));
    return editorModulePromise;
}

const LazyCodeEditor = lazy(loadEditorModule);

export function preloadCodeEditor(): void {
    void loadEditorModule();
}

function CodeEditorFallback({ id, label }: CodeEditorProps) {
    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <div className="space-y-2 rounded-md border border-border/70 bg-black/35 p-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-5 w-12 rounded-sm" />
                        <Skeleton className="h-5 w-12 rounded-sm" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-sm" />
                </div>
                <Skeleton id={id} className="h-36 w-full" />
            </div>
        </div>
    );
}

function CodeEditor(props: CodeEditorProps) {
    return (
        <Suspense fallback={<CodeEditorFallback {...props} />}>
            <LazyCodeEditor {...props} />
        </Suspense>
    );
}

export { CodeEditor };
export type { CodeEditorProps };
