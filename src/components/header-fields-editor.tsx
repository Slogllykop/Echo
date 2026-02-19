import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HeaderFieldDraft } from "@/lib/rule-form";

interface HeaderFieldsEditorProps {
    id: string;
    label: string;
    fields: HeaderFieldDraft[];
    onChange: (fields: HeaderFieldDraft[]) => void;
}

function createEmptyField(): HeaderFieldDraft {
    return {
        id: crypto.randomUUID(),
        key: "",
        value: "",
    };
}

function HeaderFieldsEditor({ id, label, fields, onChange }: HeaderFieldsEditorProps) {
    const effectiveFields = fields.length > 0 ? fields : [createEmptyField()];

    function updateField(fieldId: string, part: "key" | "value", value: string): void {
        onChange(
            effectiveFields.map((field) =>
                field.id === fieldId ? { ...field, [part]: value } : field,
            ),
        );
    }

    function deleteField(fieldId: string): void {
        const nextFields = effectiveFields.filter((field) => field.id !== fieldId);
        onChange(nextFields.length > 0 ? nextFields : [createEmptyField()]);
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <Label htmlFor={id}>{label}</Label>
                <Button
                    type="button"
                    size="xs"
                    variant="default"
                    onClick={() => onChange([...effectiveFields, createEmptyField()])}
                >
                    <IconPlus />
                    Header
                </Button>
            </div>

            <div className="space-y-2">
                {effectiveFields.map((field) => (
                    <div
                        key={field.id}
                        className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
                    >
                        <Input
                            id={id}
                            placeholder="Header name"
                            value={field.key}
                            onChange={(event) => updateField(field.id, "key", event.target.value)}
                        />
                        <Input
                            placeholder="Header value"
                            value={field.value}
                            onChange={(event) => updateField(field.id, "value", event.target.value)}
                        />
                        <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => deleteField(field.id)}
                        >
                            <IconTrash className="text-destructive" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export { HeaderFieldsEditor };
