import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Badge, ChipRow, EmptyState, Skeleton } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api, ApiError } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";
import { formatINR } from "@/src/utils/format";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Rejected", value: "rejected" },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Members() {
  const { isAdmin } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (status) q.set("status", status);
      if (search.trim()) q.set("search", search.trim());
      const res = await api.get(`/members?${q.toString()}`);
      setMembers(res);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const act = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    try {
      await api.post(`/members/${id}/${action}`);
      show(`Member ${action === "approve" ? "approved" : "rejected"}`, "success");
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Action failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/member/${item.id}`)}
      testID={`member-card-${item.id}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(item.full_name || "?")}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.full_name}</Text>
          <Text style={styles.mobile}>{item.mobile}</Text>
        </View>
        <Badge
          label={item.status}
          tone={item.status === "active" ? "success" : item.status === "pending" ? "warning" : "error"}
        />
      </View>
      {item.status === "active" && item.target_amount > 0 && (
        <View style={styles.finRow}>
          <FinPill label="Target" value={formatINR(item.target_amount)} />
          <FinPill label="Collected" value={formatINR(item.collected)} tint={colors.success} />
          <FinPill label="Pending" value={formatINR(item.pending)} tint={item.pending > 0 ? colors.warning : colors.success} />
        </View>
      )}
      {isAdmin && item.status === "pending" && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.smallBtn, { backgroundColor: colors.success }]}
            onPress={() => act(item.id, "approve")}
            disabled={busy === item.id}
            testID={`approve-${item.id}`}
          >
            <Ionicons name="checkmark" size={16} color="#FFF" />
            <Text style={styles.smallBtnText}>Approve</Text>
          </Pressable>
          <Pressable
            style={[styles.smallBtn, { backgroundColor: colors.error }]}
            onPress={() => act(item.id, "reject")}
            disabled={busy === item.id}
            testID={`reject-${item.id}`}
          >
            <Ionicons name="close" size={16} color="#FFF" />
            <Text style={styles.smallBtnText}>Reject</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Members" subtitle={`${members.length} member${members.length !== 1 ? "s" : ""}`} />
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or mobile"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            testID="member-search-input"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ChipRow options={FILTERS} value={status} onChange={setStatus} testID="member-filter-chips" />

      {loading ? (
        <View style={{ padding: spacing.lg }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={90} />)}
        </View>
      ) : members.length === 0 ? (
        <EmptyState icon="people-outline" title="No members found" subtitle="Members will appear here once added or approved." />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + 90, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {isAdmin && (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 76 }]}
          onPress={() => router.push("/add-member")}
          testID="add-member-fab"
        >
          <Ionicons name="person-add" size={24} color="#FFF" />
        </Pressable>
      )}
    </View>
  );
}

function FinPill({ label, value, tint = colors.onSurface }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.finPill}>
      <Text style={styles.finLabel}>{label}</Text>
      <Text style={[styles.finValue, { color: tint }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surfaceSecondary },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurface },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.brand },
  name: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface },
  mobile: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, marginTop: 1 },
  finRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  finPill: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  finLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  finValue: { fontFamily: fonts.displayMedium, fontSize: fontSize.base, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  smallBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: 10, borderRadius: radius.md },
  smallBtnText: { color: "#FFF", fontFamily: fonts.semibold, fontSize: fontSize.base },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
});
