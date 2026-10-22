import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { useSignupFlow, type SignupSchool } from "@/lib/signup-flow";
import {
  useDebouncedValue,
  useUniversitySearch,
  type UniversityRow,
} from "@/lib/universities";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function SchoolRow({
  school,
  onPress,
}: {
  school: UniversityRow;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`school-row-${school.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${school.name}${school.state ? `, ${school.state}` : ""}`}
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-surfaceRaised">
        <Text variant="label">{initials(school.name)}</Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1}>{school.name}</Text>
        <Text variant="muted" className="text-xs">
          {[school.state, school.country].filter(Boolean).join(", ")}
        </Text>
      </View>
      {school.short_name ? (
        <View className="rounded-md border border-border px-2 py-1">
          <Text variant="label" className="text-xs">
            {school.short_name}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function PickSchoolScreen() {
  const router = useRouter();
  const setSchool = useSignupFlow((s) => s.setSchool);

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query);
  const { data, isPending, isError, refetch } =
    useUniversitySearch(debounced);
  const searching = debounced.trim().length >= 2;

  const choose = (school: UniversityRow) => {
    const picked: SignupSchool = {
      id: school.id,
      name: school.name,
      short_name: school.short_name,
      state: school.state,
      email_domains: school.email_domains ?? [],
    };
    setSchool(picked);
    router.push("/sign-up");
  };

  return (
    <Screen contentClassName="gap-5">
      <View className="gap-2 pt-6">
        <Text variant="heading">Pick your school</Text>
        <Text variant="muted">
          Search by name or abbreviation. You will verify a school email
          next.
        </Text>
      </View>

      <View className="gap-2">
        <Label nativeID="school-search-label">School</Label>
        <Input
          nativeID="school-search"
          aria-labelledby="school-search-label"
          testID="school-search"
          placeholder="e.g. University of Virginia, UVA"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
        />
      </View>

      <FlatList
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-2 pb-4"
        data={searching ? (data ?? []) : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SchoolRow school={item} onPress={() => choose(item)} />
        )}
        ListEmptyComponent={
          !searching ? (
            <View className="items-center gap-2 py-10">
              <Text variant="muted" className="text-center">
                Start typing to find your school.
              </Text>
            </View>
          ) : isPending ? (
            <View className="items-center gap-2 py-10">
              <Text variant="muted">Searching…</Text>
            </View>
          ) : isError ? (
            <View className="items-center gap-3 py-10">
              <Text variant="muted" className="text-center">
                {"We couldn't load schools"}. Check your connection.
              </Text>
              <Button variant="secondary" onPress={() => void refetch()}>
                Try again
              </Button>
            </View>
          ) : data?.length === 0 ? (
            <View className="items-center gap-2 py-10">
              <Text variant="muted" className="text-center">
                No schools match {`"${query}"`}.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View className="mt-4 items-center gap-3 border-t border-border pt-4">
            <Text variant="muted" className="text-center text-xs">
              {"Your school can't be changed later — pick carefully."}
            </Text>
            <Button
              variant="ghost"
              testID="school-not-listed"
              onPress={() => router.push("/school-unavailable")}
            >
              {"My school isn't listed"}
            </Button>
          </View>
        }
      />
    </Screen>
  );
}
