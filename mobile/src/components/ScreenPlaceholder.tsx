import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenPlaceholderProps = {
  title: string;
  subtitle: string;
};

/** Temporary stand-in screen until the real implementation lands. */
export function ScreenPlaceholder({ title, subtitle }: ScreenPlaceholderProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-black text-text">{title}</Text>
        <Text className="mt-2 text-center text-base text-text-muted">
          {subtitle}
        </Text>
      </View>
    </SafeAreaView>
  );
}
