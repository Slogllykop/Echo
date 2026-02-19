import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { IconBraces, IconCode, IconSparkles } from "@tabler/icons-react";
import CodeMirror from "@uiw/react-codemirror";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { BodyLanguage } from "@/lib/rule-form";

export interface CodeEditorProps {
    id: string;
    label: string;
    value: string;
    language: BodyLanguage;
    onChange: (value: string) => void;
    onLanguageChange: (language: BodyLanguage) => void;
    onFormatJson?: () => void;
    height?: string;
    allowLanguageSwitch?: boolean;
}

function CodeEditorImpl({
    id,
    label,
    value,
    language,
    onChange,
    onLanguageChange,
    onFormatJson,
    height = "180px",
    allowLanguageSwitch = true,
}: CodeEditorProps) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id}>{label}</Label>
                <div className="flex items-center gap-1">
                    {language === "json" && onFormatJson && (
                        <Button type="button" size="xs" variant="outline" onClick={onFormatJson}>
                            <IconSparkles />
                            Format
                        </Button>
                    )}
                    {allowLanguageSwitch && (
                        <>
                            <Button
                                type="button"
                                size="xs"
                                variant={language === "json" ? "default" : "ghost"}
                                onClick={() => onLanguageChange("json")}
                            >
                                <IconBraces />
                                JSON
                            </Button>
                            <Button
                                type="button"
                                size="xs"
                                variant={language === "text" ? "default" : "ghost"}
                                onClick={() => onLanguageChange("text")}
                            >
                                <IconCode />
                                Text
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border/70 bg-black/35">
                <CodeMirror
                    id={id}
                    value={value}
                    height={height}
                    theme={oneDark}
                    extensions={language === "json" ? [json()] : []}
                    basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        autocompletion: true,
                        bracketMatching: true,
                        closeBrackets: true,
                        searchKeymap: true,
                    }}
                    onChange={onChange}
                />
            </div>
        </div>
    );
}

export default CodeEditorImpl;
