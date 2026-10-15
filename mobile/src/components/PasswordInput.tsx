import { forwardRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Input, type InputProps } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

/**
 * Password field with a show/hide toggle. Pass textContentType
 * ("newPassword" on sign-up/reset, "password" on log-in) for password
 * manager integration.
 */
export const PasswordInput = forwardRef<TextInput, InputProps>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <View className="justify-center">
        <Input
          ref={ref}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          className="pr-14"
          {...props}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          hitSlop={8}
          className="absolute right-1 h-11 w-12 items-center justify-center"
        >
          <Text variant="caption" className="font-semibold">
            {visible ? "Hide" : "Show"}
          </Text>
        </Pressable>
      </View>
    );
  },
);
