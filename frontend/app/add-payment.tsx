import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button, Field } from "@/src/components/ui";
import { Picker } from "@/src/components/Picker";
import { useToast } from "@/src/components/Toast";
import { api, ApiError } from "@/src/api/client";
import { colors, fonts, fontSize, spacing, radius } from "@/src/theme";
import { formatINR } from "@/src/utils/format";

const MODES = ["Cash", "UPI", "Bank Transfer", "Other"].map((m) => ({ label: m, value: m }));

export default function AddPayment() {
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ memberId?: string }>();

  const [members, setMembers] = useState<any[]>([]);
  const [memberId, setMemberId] = useState<string | null>(params.memberId || null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string | null>("Cash");
  const [txn, setTxn] = useState("");
  const [remarks, setRemarks] = useState("");
  const [overpay, setOverpay] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/members?status=active").then(setMembers).catch(() => {});
  }, []);

  const selected = members.find((m) => m.id === memberId);

  const submit = async () => {
    if (!memberId) return show("Select a member", "error");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return show("Enter a valid amount", "error");
    if (!mode) return show("Select payment mode", "error");
    setLoading(true);
    try {
      await api.post("/payments", {
        member_id: memberId,
        amount: amt,
        payment_mode: mode,
        transaction_number: txn || null,
        remarks: remarks || null,
        allow_overpay: overpay,
      });
      show("Vargani payment added successfully", "success");
      router.back();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Failed to add payment", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Add Vargani Payment</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="close-modal">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Picker
          label="Member"
          placeholder="Select member"
          icon="person-outline"
          value={memberId}
          options={members.map((m) => ({ label: `${m.full_name} (${m.mobile})`, value: m.id }))}
          onChange={setMemberId}
          testID="payment-member-picker"
        />
        {selected ? (
          <View style={styles.info}>
            <Text style={styles.infoText}>Target: {formatINR(selected.target_amount)}</Text>
            <Text style={styles.infoText}>Collected: {formatINR(selected.collected)}</Text>
            <Text style={[styles.infoText, { color: colors.warning }]}>Pending: {formatINR(selected.pending)}</Text>
          </View>
        ) : null}

        <Field label="Amount (₹)" placeholder="0" icon="cash-outline" keyboardType="numeric" value={amount} onChangeText={setAmount} testID="payment-amount-input" />
        <Picker label="Payment Mode" value={mode} options={MODES} onChange={setMode} icon="wallet-outline" testID="payment-mode-picker" />
        <Field label="Transaction Number (optional)" placeholder="UPI/Bank ref" value={txn} onChangeText={setTxn} testID="payment-txn-input" />
        <Field label="Remarks (optional)" placeholder="Any notes" value={remarks} onChangeText={setRemarks} testID="payment-remarks-input" />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Allow over-payment</Text>
            <Text style={styles.switchSub}>Permit amount exceeding pending target</Text>
          </View>
          <Switch value={overpay} onValueChange={setOverpay} trackColor={{ true: colors.brandPrimary }} testID="payment-overpay-switch" />
        </View>

        <Button title="Add Payment" onPress={submit} loading={loading} icon="checkmark" testID="payment-submit-button" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  info: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, gap: 2 },
  infoText: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurfaceTertiary },
  switchRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  switchLabel: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  switchSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
});
