import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Badge, Button, Card, ProgressBar, EmptyState } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api, ApiError } from "@/src/api/client";
import { shareReceipt } from "@/src/utils/receipt";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";
import { formatINR, formatDate } from "@/src/utils/format";

export default function MemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [member, setMember] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([api.get(`/members/${id}`), api.get(`/payments?member_id=${id}`)]);
      setMember(m);
      setPayments(p);
    } catch {
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.del(`/members/${id}`);
      show("Member deleted", "success");
      setConfirmDelete(false);
      router.back();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  const pct = member?.target_amount > 0 ? (member.collected / member.target_amount) * 100 : 0;

  const onShareReceipt = async (p: any) => {
    try {
      await shareReceipt({
        id: p.id,
        member_name: member.full_name,
        amount: p.amount,
        payment_mode: p.payment_mode,
        payment_date: p.payment_date,
        transaction_number: p.transaction_number,
        remarks: p.remarks,
      });
    } catch {
      show("Could not generate receipt", "error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Member Details" back />
      {loading ? (
        <View style={{ padding: spacing["3xl"] }}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : !member ? (
        <EmptyState icon="person-outline" title="Member not found" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(member.full_name || "?").slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{member.full_name}</Text>
                <Text style={styles.meta}>{member.mobile}</Text>
                {member.email ? <Text style={styles.meta}>{member.email}</Text> : null}
              </View>
              <Badge label={member.status} tone={member.status === "active" ? "success" : member.status === "pending" ? "warning" : "error"} />
            </View>
            {member.address ? <Text style={[styles.meta, { marginTop: spacing.md }]}>📍 {member.address}</Text> : null}
            <Text style={[styles.meta, { marginTop: spacing.xs }]}>Joined {formatDate(member.joining_date)}</Text>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Vargani Summary</Text>
            <View style={styles.finGrid}>
              <Fin label="Target" value={formatINR(member.target_amount)} />
              <Fin label="Advance" value={formatINR(member.advance_amount)} tint={colors.brandSecondary} />
              <Fin label="Collected" value={formatINR(member.collected)} tint={colors.success} />
              <Fin label="Pending" value={formatINR(member.pending)} tint={member.pending > 0 ? colors.warning : colors.success} />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar percent={pct} />
              <Text style={styles.pctText}>{Math.round(pct)}% collected</Text>
            </View>
          </Card>

          {isAdmin && (
            <View style={styles.adminActions}>
              <Button title="Edit" variant="outline" icon="create-outline" onPress={() => router.push(`/add-member?memberId=${id}`)} style={{ flex: 1 }} testID="edit-member-button" />
              <Button title="Delete" variant="danger" icon="trash-outline" onPress={() => setConfirmDelete(true)} style={{ flex: 1 }} testID="delete-member-button" />
            </View>
          )}

          {isAdmin && member.status === "active" && (
            <Button title="Add Payment" icon="add" onPress={() => router.push(`/add-payment?memberId=${id}`)} testID="member-add-payment" />
          )}

          <Text style={styles.sectionTitle}>Payment History</Text>
          {payments.length === 0 ? (
            <Card><Text style={styles.emptyText}>No payments recorded yet.</Text></Card>
          ) : (
            <Card style={{ paddingVertical: spacing.xs }}>
              {payments.map((p, i) => (
                <View key={p.id} style={[styles.payRow, i === payments.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.payIcon}><Ionicons name="cash" size={16} color={colors.success} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payMode}>{p.payment_mode}</Text>
                    <Text style={styles.payDate}>{formatDate(p.payment_date)}{p.transaction_number ? ` · ${p.transaction_number}` : ""}</Text>
                  </View>
                  <Text style={styles.payAmount}>+{formatINR(p.amount)}</Text>
                  <Pressable onPress={() => onShareReceipt(p)} hitSlop={8} style={styles.receiptBtn} testID={`receipt-${p.id}`}>
                    <Ionicons name="share-outline" size={18} color={colors.brand} />
                  </Pressable>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}

      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirmDelete(false)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <View style={styles.confirmIcon}><Ionicons name="trash" size={26} color={colors.error} /></View>
            <Text style={styles.confirmTitle}>Delete member?</Text>
            <Text style={styles.confirmSub} numberOfLines={2}>"{member?.full_name}" and their record will be removed.</Text>
            <View style={styles.confirmActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} testID="cancel-delete-member" />
              <Button title="Delete" variant="danger" onPress={doDelete} loading={deleting} style={{ flex: 1 }} testID="confirm-delete-member" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Fin({ label, value, tint = colors.onSurface }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.finItem}>
      <Text style={styles.finLabel}>{label}</Text>
      <Text style={[styles.finValue, { color: tint }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.brand },
  name: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.md },
  finGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  finItem: { width: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  finLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted },
  finValue: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, marginTop: 2 },
  pctText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.sm },
  payRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  payIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" },
  payMode: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  payDate: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  payAmount: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, color: colors.success },
  receiptBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  adminActions: { flexDirection: "row", gap: spacing.md },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, width: "100%", maxWidth: 400, alignItems: "center" },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  confirmTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  confirmSub: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl },
  confirmActions: { flexDirection: "row", gap: spacing.md, width: "100%" },
  emptyText: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted },
});
