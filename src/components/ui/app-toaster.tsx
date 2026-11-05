"use client";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/20/solid";
import { Toaster } from "sonner";
import "./app-toaster.css";

/**
 * The one toast stack of the app (Sonner), in ANGI's look: white cards with the theme's line and
 * pop shadow, a coloured round icon per kind, bottom centre (the header and its bell stay clear).
 * Only the message is shown: no close or action button, the toast leaves by itself. Messages are
 * sent with `notify` (src/shared/ui/notify.ts).
 */
export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      visibleToasts={3}
      gap={10}
      offset={24}
      mobileOffset={16}
      containerAriaLabel="Thông báo"
      icons={{
        success: <CheckCircleIcon aria-hidden />,
        error: <XCircleIcon aria-hidden />,
        warning: <ExclamationTriangleIcon aria-hidden />,
        info: <InformationCircleIcon aria-hidden />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "app-toast",
          icon: "app-toast-icon",
          content: "app-toast-content",
          title: "app-toast-title",
          description: "app-toast-description",
          success: "is-success",
          error: "is-error",
          warning: "is-warning",
          info: "is-info",
        },
      }}
    />
  );
}
