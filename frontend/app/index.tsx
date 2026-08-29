import { View, ActivityIndicator } from "react-native";
import { colors } from "@/src/theme";

export default function Index() {
  // Auth guard in the root layout redirects to /(auth)/login or /(tabs).
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}
