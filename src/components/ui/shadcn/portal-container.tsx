"use client";
import { createContext, useContext } from "react";

/**
 * Where floating lists and pickers render. A modal `<dialog>` lives in the browser's top layer and
 * makes the rest of the page inert, so inside one they must render in the dialog itself.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer() {
  return useContext(PortalContainerContext) ?? undefined;
}
