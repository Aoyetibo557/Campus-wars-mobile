import { forwardRef } from "react";
import { TextInput } from "react-native";

import { Input, type InputProps } from "@/components/ui/input";
import { isCompleteCode } from "@/lib/validation";

export type CodeInputProps = Omit<InputProps, "value" | "onChangeText"> & {
  value: string;
  onChangeCode: (code: string) => void;
  /** Called once per entry when the 6th digit lands. */
  onComplete: (code: string) => void;
};

/**
 * 6-digit OTP field. Digits only, auto-fires `onComplete` at 6, and stays
 * a single accessible TextInput (better for screen readers and autofill
 * than six fake boxes).
 */
export const CodeInput = forwardRef<TextInput, CodeInputProps>(
  function CodeInput({ value, onChangeCode, onComplete, ...props }, ref) {
    const handleChange = (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 6);
      onChangeCode(digits);
      if (isCompleteCode(digits)) onComplete(digits);
    };

    return (
      <Input
        ref={ref}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        inputMode="numeric"
        className="text-center text-2xl font-bold tracking-[0.5em]"
        {...props}
      />
    );
  },
);
