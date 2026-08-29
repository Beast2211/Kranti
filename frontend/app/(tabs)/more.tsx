import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  member: "Member",
};

export default function More() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items: { label: string; icon: any; route: string; show: boolean; tone?: string }[] = [
    { label: "Events", icon: "calendar", route: "/events", show: true },
    { label: "Reports", icon: "bar-chart", route: "/reports", show: true },
    { label: "Notifications", icon: "notifications", route: "/notifications", show: true },
    { label: "Member Approvals", icon: "person-add", route: "/approvals", show: isAdmin },
    { label: "Admin Management", icon: "shield-checkmark", route: "/admins", show: isSuperAdmin },
    { label: "Audit Logs", icon: "document-text", route: "/audit-logs", show: isSuperAdmin },
    { label: "Profile", icon: "person-circle", route: "/profile", show: true },
    { label: "Change Password", icon: "key", route: "/change-password", show: true },
  ];

  const onLogout = async () => {
    await logout();
    show("Signed out", "info");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="More" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={26} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.full_name}</Text>
            <Text style={styles.sub}>{user?.user_id || user?.mobile}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{ROLE_LABEL[user?.role || "member"]}</Text>
          </View>
        </View>

        <View style={styles.menu}>
          {items.filter((i) => i.show).map((item, idx, arr) => (
            <Pressable
              key={item.label}
              style={[styles.menuRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => router.push(item.route as any)}
              testID={`more-${item.label.replace(/\s/g, "-").toLowerCase()}`}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={20} color={colors.brand} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logout} onPress={onLogout} testID="logout-button">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <Text style={styles.version}>Kranti Ganesh Mandal · 2026</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card, marginBottom: spacing.lg },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, marginTop: 1 },
  roleBadge: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  roleText: { fontFamily: fonts.bold, fontSize: 11, color: colors.brand },
  menu: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadow.card },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, minHeight: 56 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: "#FEE2E2", backgroundColor: "#FEF2F2" },
  logoutText: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.error },
  version: { textAlign: "center", fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.xl },
});
