import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { EmptyState, ProgressBar, Skeleton } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { shareReceipt } from "@/src/utils/receipt";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";
import { formatINR, formatDate } from "@/src/utils/format";

const MODE_ICON: Record<string, any> = {
  Cash: "cash-outline",
  UPI: "phone-portrait-outline",
  "Bank Transfer": "business-outline",
  Other: "ellipsis-horizontal",
};

export default function Vargani() {
  const { isAdmin } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api.get("/payments"), api.get("/reports/vargani")]);
      setPayments(p);
      setSummary(s);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const filtered = payments.filter((p) =>
    !search.trim() ? true : (p.member_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const pct = summary?.total_target > 0 ? (summary.total_collected / summary.total_target) * 100 : 0;

  const header = (
    <View>
      {summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.sumLabel}>Collected</Text>
              <Text style={[styles.sumValue, { color: colors.success }]} testID="vargani-collected">
                {formatINR(summary.total_collected)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.sumLabel}>Target</Text>
              <Text style={styles.sumValue}>{formatINR(summary.total_target)}</Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar percent={pct} />
          </View>
          <View style={styles.badgeRow}>
            <StatChip icon="checkmark-circle" label={`${summary.paid_count} Paid`} tint={colors.success} />
            <StatChip icon="time" label={`${summary.partial_count} Partial`} tint={colors.warning} />
            <StatChip icon="alert-circle" label={`${summary.pending_count} Pending`} tint={colors.error} />
          </View>
        </View>
      )}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by member"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          testID="vargani-search-input"
        />
      </View>
      <Text style={styles.ledgerTitle}>Payment Ledger</Text>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.row} testID={`payment-row-${item.id}`}>
      <View style={styles.rowIcon}>
        <Ionicons name={MODE_ICON[item.payment_mode] || "cash-outline"} size={18} color={colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.member_name}</Text>
        <Text style={styles.rowMeta}>{formatDate(item.payment_date)} · {item.payment_mode}</Text>
      </View>
      <Text style={styles.rowAmount}>+{formatINR(item.amount)}</Text>
      <Pressable
        onPress={async () => {
          try {
            await shareReceipt({
              id: item.id, member_name: item.member_name, amount: item.amount,
              payment_mode: item.payment_mode, payment_date: item.payment_date,
              transaction_number: item.transaction_number, remarks: item.remarks,
            });
          } catch {
            show("Could not generate receipt", "error");
          }
        }}
        hitSlop={8}
        style={styles.receiptBtn}
        testID={`receipt-${item.id}`}
      >
        <Ionicons name="share-outline" size={18} color={colors.brand} />
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Vargani" subtitle="Community contributions" />
      {loading ? (
        <View style={{ padding: spacing.lg }}>
          <Skeleton height={140} />
          {[1, 2, 3].map((i) => <Skeleton key={i} height={64} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon="cash-outline" title="No contributions yet" subtitle="Recorded Vargani payments will appear here." />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      {isAdmin && (
        <Pressable style={[styles.fab, { bottom: insets.bottom + 76 }]} onPress={() => router.push("/add-payment")} testID="add-payment-fab">
          <Ionicons name="add" size={28} color="#FFF" />
        </Pressable>
      )}
    </View>
  );
}

function StatChip({ icon, label, tint }: { icon: any; label: string; tint: string }) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={14} color={tint} />
      <Text style={[styles.statChipText, { color: tint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card, marginBottom: spacing.md },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  sumLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted },
  sumValue: { fontFamily: fonts.displayBold, fontSize: fontSize["2xl"], color: colors.onSurface, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill },
  statChipText: { fontFamily: fonts.semibold, fontSize: 11 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurface },
  ledgerTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" },
  rowName: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  rowMeta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  rowAmount: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, color: colors.success },
  receiptBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  fab: { position: "absolute", right: spacing.lg, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", ...shadow.raised },
});
