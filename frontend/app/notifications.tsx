import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { EmptyState, Skeleton } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { timeAgo } from "@/src/utils/format";

const TYPE_ICON: Record<string, any> = {
  approval: "person-add", success: "checkmark-circle", error: "close-circle",
  payment: "cash", expense: "receipt", event: "calendar", info: "information-circle",
};
const TYPE_TINT: Record<string, string> = {
  approval: colors.brand, success: colors.success, error: colors.error,
  payment: colors.success, expense: colors.error, event: colors.brandSecondary, info: colors.info,
};

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setItems(res.notifications);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const markAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  const tap = async (n: any) => {
    if (!n.is_read) {
      await api.post(`/notifications/${n.id}/read`);
      load();
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable style={[styles.row, !item.is_read && styles.unread]} onPress={() => tap(item)} testID={`notification-${item.id}`}>
      <View style={[styles.icon, { backgroundColor: (TYPE_TINT[item.type] || colors.info) + "1A" }]}>
        <Ionicons name={TYPE_ICON[item.type] || "notifications"} size={18} color={TYPE_TINT[item.type] || colors.info} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
      {!item.is_read && <View style={styles.dot} />}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader
        title="Notifications"
        back
        right={
          items.some((i) => !i.is_read) ? (
            <Pressable onPress={markAll} testID="mark-all-read"><Text style={styles.markAll}>Mark all read</Text></Pressable>
          ) : null
        }
      />
      {loading ? (
        <View style={{ padding: spacing.lg }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={76} />)}</View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="No notifications" subtitle="You're all caught up!" />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  markAll: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.brand },
  row: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  unread: { backgroundColor: colors.surfaceTertiary, borderColor: colors.brandTertiary },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.onSurface },
  message: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: 2 },
  time: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand, marginTop: 6 },
});
