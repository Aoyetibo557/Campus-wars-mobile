import { Modal, View, type ModalProps } from "react-native";
import type { ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type AlertDialogProps = Pick<ModalProps, "onRequestClose"> & {
  /** Controlled only — the dialog renders iff `open`. */
  open: boolean;
  /**
   * Called when the user asks to dismiss via the system back button or
   * accessibility escape. Actions and cancels never call this — the caller
   * decides when to close, so async flows can show loading without the
   * dialog closing underneath them (and double submits are impossible).
   */
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

/**
 * Controlled confirmation dialog. Compose:
 *
 *   <AlertDialog open={open} onOpenChange={setOpen}>
 *     <AlertDialogContent>
 *       <AlertDialogHeader>
 *         <AlertDialogTitle>...</AlertDialogTitle>
 *         <AlertDialogDescription>...</AlertDialogDescription>
 *       </AlertDialogHeader>
 *       <AlertDialogFooter>
 *         <AlertDialogCancel onPress={...}>Cancel</AlertDialogCancel>
 *         <AlertDialogAction onPress={...}>Confirm</AlertDialogAction>
 *       </AlertDialogFooter>
 *     </AlertDialogContent>
 *   </AlertDialog>
 */
export function AlertDialog({
  open,
  onOpenChange,
  children,
}: AlertDialogProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => onOpenChange(false)}
    >
      {children}
    </Modal>
  );
}

export function AlertDialogContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    // Scrim: token-derived translucent background (bg-background/80), so it
    // follows the theme instead of a hardcoded black overlay.
    <View className="flex-1 items-center justify-center bg-background/80 px-6">
      <View
        className={cn(
          "w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-6",
          className,
        )}
      >
        {children}
      </View>
    </View>
  );
}

export function AlertDialogHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <View className={cn("gap-2", className)}>{children}</View>;
}

export function AlertDialogTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Text variant="title" className={className}>
      {children}
    </Text>
  );
}

export function AlertDialogDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Text variant="muted" className={className}>
      {children}
    </Text>
  );
}

export function AlertDialogFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={cn("mt-6 flex-row justify-end gap-3", className)}>
      {children}
    </View>
  );
}

/** Fires `onPress` only — closing is the caller's job (controlled dialog). */
export function AlertDialogAction(props: ButtonProps) {
  return <Button variant="default" {...props} />;
}

export function AlertDialogCancel(props: ButtonProps) {
  return <Button variant="outline" {...props} />;
}
