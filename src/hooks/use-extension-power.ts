import { useCallback } from "react";
import { sendRuntimeMessage } from "@/lib/runtime";
import type { RulesListPayload } from "@/lib/types";

interface UseExtensionPowerOptions {
    setWorking: React.Dispatch<React.SetStateAction<boolean>>;
    setErrorMessage: (message: string | null) => void;
    onSync: (data: RulesListPayload) => void;
}

export interface UseExtensionPowerReturn {
    setExtensionPower: (enabled: boolean) => Promise<void>;
}

export function useExtensionPower({
    setWorking,
    setErrorMessage,
    onSync,
}: UseExtensionPowerOptions): UseExtensionPowerReturn {
    const setExtensionPower = useCallback(
        async (enabled: boolean) => {
            setWorking(true);
            setErrorMessage(null);

            const response = await sendRuntimeMessage<RulesListPayload>({
                type: "extension:set-enabled",
                enabled,
            });
            if (!response.ok) {
                setErrorMessage(response.error);
                setWorking(false);
                return;
            }

            onSync(response.data);
            setWorking(false);
        },
        [setWorking, setErrorMessage, onSync],
    );

    return { setExtensionPower };
}
