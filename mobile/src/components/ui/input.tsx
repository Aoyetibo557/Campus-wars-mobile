import { forwardRef, useState, type ComponentProps } from "react";
import { TextInput } from "react-native";

import { cn } from "@/lib/utils";

export type InputProps = ComponentProps<typeof TextInput> & {
  className?: string;
  /** Marks the field invalid: danger border + aria-invalid. */
  error?: boolean;
};

/**
 * Bordered text field on our tokens. `placeholderClassName` styles the
 * placeholder via NativeWind (verified on device — fall back to
 * `placeholderTextColor={useThemeColor("textMuted")}` if it ever regresses).
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { className, error, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      ref={ref}
      placeholderClassName="text-text-muted"
      aria-invalid={error || undefined}
      className={cn(
        "h-12 rounded-xl border bg-surface px-4 text-base text-text",
        error
          ? "border-danger"
          : focused
            ? "border-accent"
            : "border-border",
        className,
      )}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...props}
    />
  );
});
