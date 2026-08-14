import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { preventRainbowKitDialogDismiss } from "@/lib/rainbowkit-overlay";
import { cn } from "@/lib/utils";
import { DESKTOP_MEDIA_QUERY } from "./config";

const rainbowKitDismiss = {
  onPointerDownOutside: preventRainbowKitDialogDismiss,
  onInteractOutside: preventRainbowKitDialogDismiss,
  onFocusOutside: preventRainbowKitDialogDismiss,
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  children,
  desktopClassName,
  sheetClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  desktopClassName?: string;
  sheetClassName?: string;
}) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className={cn(desktopClassName)}
          {...rainbowKitDismiss}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(sheetClassName)}
        {...rainbowKitDismiss}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
