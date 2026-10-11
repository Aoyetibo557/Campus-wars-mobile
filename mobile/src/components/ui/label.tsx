import { type TextProps } from "react-native";

import { Text } from "@/components/ui/text";

/**
 * Form label. Pass `nativeID` matching the input's `aria-labelledby`
 * (or an `onPress` that focuses it) to wire label → control.
 */
export function Label({ className, ...props }: TextProps) {
  return <Text variant="label" className={className} {...props} />;
}
