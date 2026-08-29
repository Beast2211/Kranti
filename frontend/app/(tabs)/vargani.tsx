import React, { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Button, EmptyState, ProgressBar, Skeleton } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api, ApiError } from "@/src/api/client";
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
  const [confirm, setConfirm] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

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

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.del(`/payments/${confirm.id}`);
      show("Payment deleted", "success");
      setConfirm(null);
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  };

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
    <View style={styles.card} testID={`payment-row-${item.id}`}>
      <View style={styles.rowMain}>
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
      {isAdmin && (
        <View style={styles.adminRow}>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/add-payment?paymentId=${item.id}`)} testID={`edit-payment-${item.id}`}>
            <Ionicons name="create-outline" size={15} color={colors.brand} />
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { borderColor: colors.error }]} onPress={() => setConfirm(item)} testID={`delete-payment-${item.id}`}>
            <Ionicons name="trash-outline" size={15} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
          </Pressable>
        </View>
      )}
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

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirm(null)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <View style={styles.confirmIcon}><Ionicons name="trash" size={26} color={colors.error} /></View>
            <Text style={styles.confirmTitle}>Delete payment?</Text>
            <Text style={styles.confirmSub} numberOfLines={2}>
              {confirm ? `${formatINR(confirm.amount)} from ${confirm.member_name}` : ""} will be removed from the ledger.
            </Text>
            <View style={styles.confirmActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setConfirm(null)} style={{ flex: 1 }} testID="cancel-delete-payment" />
              <Button title="Delete" variant="danger" onPress={doDelete} loading={deleting} style={{ flex: 1 }} testID="confirm-delete-payment" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowMain: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" },
  rowName: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  rowMeta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  rowAmount: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, color: colors.success },
  receiptBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  adminRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  actionText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.brand },
  fab: { position: "absolute", right: spacing.lg, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", ...shadow.raised },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, width: "100%", maxWidth: 400, alignItems: "center" },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  confirmTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  confirmSub: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl },
  confirmActions: { flexDirection: "row", gap: spacing.md, width: "100%" },
});
