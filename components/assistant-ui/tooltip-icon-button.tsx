"use client";

import { forwardRef, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TooltipIconButtonProps = ComponentProps<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(({ tooltip, side = "top", className, children, ...props }, ref) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        ref={ref}
        size="icon"
        className={cn("size-8", className)}
        {...props}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent side={side}>{tooltip}</TooltipContent>
  </Tooltip>
));

TooltipIconButton.displayName = "TooltipIconButton";
