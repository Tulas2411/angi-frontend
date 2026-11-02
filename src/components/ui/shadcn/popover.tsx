"use client";
import type { ComponentProps } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { usePortalContainer } from "./portal-container";
import { cn } from "./utils";
import "./shadcn.css";

/** shadcn/ui Popover (Radix): the rounded floating panel that holds the date and time pickers. */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  const container = usePortalContainer();
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        className={cn("ui-popover-content", className)}
        align={align}
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
