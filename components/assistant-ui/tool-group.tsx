"use client";

import {
  createContext,
  useContext,
  useState,
  type ComponentPropsWithoutRef,
  type FC,
  type ReactNode,
} from "react";
import { ChevronDownIcon, WrenchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ToolGroupOpenContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export type ToolGroupRootProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
  variant?: "default" | "ghost";
};

export const ToolGroupRoot: FC<ToolGroupRootProps> = ({
  className,
  variant = "default",
  children,
  ...props
}) => {
  const [open, setOpen] = useState(false);
  return (
    <ToolGroupOpenContext.Provider value={{ open, setOpen }}>
      <div
        data-slot="tool-group-root"
        data-variant={variant}
        className={cn(
          "my-1 flex flex-col overflow-hidden rounded-xl",
          variant === "default" && "border bg-muted/50",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ToolGroupOpenContext.Provider>
  );
};

export type ToolGroupTriggerProps = ComponentPropsWithoutRef<"button"> & {
  count: number;
  active?: boolean;
};

export const ToolGroupTrigger: FC<ToolGroupTriggerProps> = ({
  count,
  active = false,
  className,
  ...props
}) => {
  const { open, setOpen } = useContext(ToolGroupOpenContext);
  return (
    <button
      type="button"
      data-slot="tool-group-trigger"
      data-state={open ? "open" : "closed"}
      onClick={() => setOpen(!open)}
      className={cn(
        "text-muted-foreground hover:text-foreground flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] transition-colors select-none",
        className,
      )}
      {...props}
    >
      <WrenchIcon className={cn("size-3.5 shrink-0", active && "animate-spin")} />
      <span className="flex-1 truncate font-medium">
        {active
          ? `Running ${count} tool${count === 1 ? "" : "s"}…`
          : `Ran ${count} tool${count === 1 ? "" : "s"}`}
      </span>
      <ChevronDownIcon
        className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
      />
    </button>
  );
};

export const ToolGroupContent: FC<ComponentPropsWithoutRef<"div">> = ({
  className,
  children,
  ...props
}) => {
  const { open } = useContext(ToolGroupOpenContext);
  if (!open) return null;
  return (
    <div
      data-slot="tool-group-content"
      className={cn("flex flex-col gap-1 px-2.5 pt-1 pb-2", className)}
      {...props}
    >
      {children}
    </div>
  );
};
