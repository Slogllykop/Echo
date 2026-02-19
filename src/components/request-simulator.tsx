import { IconFlask2, IconPlayerPlay } from "@tabler/icons-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { sendRuntimeMessage } from "@/lib/runtime";
import type { EvaluatePayload, HttpMethod, InterceptDecision, InterceptRequest } from "@/lib/types";

const SIMULATOR_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function decisionLabel(decision: InterceptDecision): string {
    if (decision.kind === "pass-through") {
        return "Pass Through";
    }
    if (decision.kind === "mock") {
        return `Mock ${decision.mock.status}`;
    }
    return "Modify";
}

function RequestOutcomePreview() {
    const [method, setMethod] = useState<HttpMethod>("GET");
    const [url, setUrl] = useState("https://api.example.com/users");
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<InterceptDecision | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function runSimulation() {
        setRunning(true);
        setErrorMessage(null);
        setResult(null);

        const request: InterceptRequest = {
            method,
            url,
            headers: {},
        };

        const response = await sendRuntimeMessage<EvaluatePayload>({
            type: "interceptor:simulate",
            request,
        });

        if (!response.ok) {
            setErrorMessage(response.error);
            setResult(null);
            setRunning(false);
            return;
        }

        setResult(response.data.decision);
        setRunning(false);
    }

    return (
        <section className="border-t border-border bg-background px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-1 text-xs font-semibold tracking-[0.14em] uppercase text-primary/90">
                    <IconFlask2 className="size-3 text-primary" />
                    Request Outcome Preview
                </h2>
                {result && (
                    <Badge variant={result.kind === "pass-through" ? "outline" : "default"}>
                        {decisionLabel(result)}
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-[96px_1fr] gap-2">
                <div className="space-y-1">
                    <Label>Method</Label>
                    <Select
                        value={method}
                        onValueChange={(value) => setMethod(value as HttpMethod)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SIMULATOR_METHODS.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="sim-url">URL</Label>
                    <Input
                        id="sim-url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                    />
                </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                    Preview how Echo will handle this request before it runs live.
                </p>
                <Button size="sm" onClick={() => void runSimulation()} disabled={running}>
                    <IconPlayerPlay />
                    {running ? "Checking..." : "Preview"}
                </Button>
            </div>

            {errorMessage && <p className="mt-2 text-[11px] text-destructive">{errorMessage}</p>}

            {running && (
                <div className="mt-2 space-y-1.5">
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-3 w-40" />
                </div>
            )}

            {result?.kind === "mock" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                    Rule <span className="text-primary">{result.ruleName}</span> returns status{" "}
                    <span className="text-foreground">{result.mock.status}</span>
                    {result.delayMs > 0 ? ` after ${result.delayMs}ms delay` : ""}.
                </p>
            )}

            {result?.kind === "modify" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                    Rule <span className="text-primary">{result.ruleName}</span> patches
                    request/response
                    {result.delayMs > 0 ? ` and adds ${result.delayMs}ms delay` : ""}.
                </p>
            )}
        </section>
    );
}

export { RequestOutcomePreview };
