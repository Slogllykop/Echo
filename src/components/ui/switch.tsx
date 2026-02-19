import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                "peer focus-visible:border-ring focus-visible:ring-ring/30 data-[checked]:bg-primary data-[unchecked]:bg-input/20 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border p-0.5 transition-colors focus-visible:ring-2 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className="pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform data-[checked]:translate-x-4 data-[unchecked]:translate-x-0"
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
