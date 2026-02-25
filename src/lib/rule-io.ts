import type { EchoRule } from "@/lib/types";

export function exportRulesToFile(rules: EchoRule[]): void {
    const exportData = {
        version: "1.0.1",
        exportedAt: new Date().toISOString(),
        rules: rules,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `echo-rules-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export type ImportResult = { ok: true; rules: EchoRule[] } | { ok: false; error: string };

export function importRulesFromFile(): Promise<ImportResult | null> {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) {
                resolve(null);
                return;
            }

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (!data.rules || !Array.isArray(data.rules)) {
                    resolve({
                        ok: false,
                        error: "Invalid import file: missing or invalid rules array",
                    });
                    return;
                }

                const importedRules = data.rules as EchoRule[];
                if (importedRules.length === 0) {
                    resolve({ ok: false, error: "Import file contains no rules" });
                    return;
                }

                const confirmed = window.confirm(
                    `Import ${importedRules.length} rule(s)? This will replace all existing rules.`,
                );
                if (!confirmed) {
                    resolve(null);
                    return;
                }

                resolve({ ok: true, rules: importedRules });
            } catch (error) {
                resolve({
                    ok: false,
                    error: `Failed to import rules: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
        };
        input.click();
    });
}
