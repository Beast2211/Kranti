import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Badge, Button, Card, ProgressBar, EmptyState } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";
import { formatINR, formatDate } from "@/src/utils/format";

export default function MemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [member, setMember] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const pct = member?.target_amount > 0 ? (member.collected / member.target_amount) * 100 : 0;

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
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
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
  emptyText: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted },
});
