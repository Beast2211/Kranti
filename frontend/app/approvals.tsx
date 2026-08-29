import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { EmptyState, Skeleton } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";
import { timeAgo } from "@/src/utils/format";

export default function Approvals() {
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.get("/members?status=pending"));
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const act = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    try {
      await api.post(`/members/${id}/${action}`);
      show(`Member ${action === "approve" ? "approved" : "rejected"}`, "success");
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Action failed", "error");
    } finally { setBusy(null); }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card} testID={`approval-${item.id}`}>
      <View style={styles.top}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(item.full_name || "?").slice(0, 2).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.full_name}</Text>
          <Text style={styles.meta}>{item.mobile} · {timeAgo(item.created_at)}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => act(item.id, "approve")} disabled={busy === item.id} testID={`approve-${item.id}`}>
          <Ionicons name="checkmark" size={18} color="#FFF" /><Text style={styles.btnText}>Approve</Text>
        </Pressable>
        <Pressable style={[styles.btn, { backgroundColor: colors.error }]} onPress={() => act(item.id, "reject")} disabled={busy === item.id} testID={`reject-${item.id}`}>
          <Ionicons name="close" size={18} color="#FFF" /><Text style={styles.btnText}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Member Approvals" subtitle={`${items.length} pending`} back />
      {loading ? (
        <View style={{ padding: spacing.lg }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={110} />)}</View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          ListEmptyComponent={<EmptyState icon="checkmark-done-outline" title="No pending approvals" subtitle="New registrations will appear here." />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.brand },
  name: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, marginTop: 1 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: 11, borderRadius: radius.md },
  btnText: { color: "#FFF", fontFamily: fonts.semibold, fontSize: fontSize.base },
});
