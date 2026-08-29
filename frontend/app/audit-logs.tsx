import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { EmptyState, Skeleton } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { timeAgo } from "@/src/utils/format";

export default function AuditLogs() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setLogs(await api.get("/audit-logs")); } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.row} testID={`audit-${item.id}`}>
      <View style={styles.iconWrap}><Ionicons name="document-text-outline" size={16} color={colors.brand} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.action}>{item.action.replace(/_/g, " ")}</Text>
        <Text style={styles.details} numberOfLines={2}>{item.details}</Text>
        <Text style={styles.meta}>{item.user_name} · {timeAgo(item.created_at)}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Audit Logs" subtitle="System activity trail" back />
      {loading ? (
        <View style={{ padding: spacing.lg }}>{[1, 2, 3, 4].map((i) => <Skeleton key={i} height={70} />)}</View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          renderItem={renderItem}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="No activity yet" />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  action: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.onSurface, textTransform: "capitalize" },
  details: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: 1 },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 3 },
});
