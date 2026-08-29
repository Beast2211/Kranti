import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Button, Card } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", admin: "Administrator", member: "Member" };

export default function Profile() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const rows = [
    { icon: "person-outline", label: "Full Name", value: user?.full_name || "-" },
    { icon: "id-card-outline", label: "User ID", value: user?.user_id || "-" },
    { icon: "call-outline", label: "Mobile", value: user?.mobile || "-" },
    { icon: "mail-outline", label: "Email", value: user?.email || "-" },
    { icon: "shield-outline", label: "Role", value: ROLE_LABEL[user?.role || "member"] },
    { icon: "checkmark-circle-outline", label: "Status", value: user?.status || "-" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Profile" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}><Ionicons name="person" size={34} color={colors.brand} /></View>
          <Text style={styles.name}>{user?.full_name}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleText}>{ROLE_LABEL[user?.role || "member"]}</Text></View>
        </View>
        <Card style={{ paddingVertical: spacing.xs }}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
              <Ionicons name={r.icon as any} size={20} color={colors.muted} />
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{r.value}</Text>
            </View>
          ))}
        </Card>
        <Button title="Change Password" variant="outline" icon="key-outline" onPress={() => router.push("/change-password")} testID="profile-change-password" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: spacing.xl },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  name: { fontFamily: fonts.bold, fontSize: fontSize["2xl"], color: colors.onSurface },
  roleBadge: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.sm },
  roleText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.brand },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.muted, width: 90 },
  rowValue: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface, textAlign: "right" },
});
