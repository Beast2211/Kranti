import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button, Field } from "@/src/components/ui";
import { Picker } from "@/src/components/Picker";
import { useToast } from "@/src/components/Toast";
import { api, ApiError } from "@/src/api/client";
import { colors, fonts, fontSize, spacing } from "@/src/theme";

const CATEGORIES = [
  "Decoration", "Electricity", "Sound System", "Lighting", "Prasad/Food",
  "Pooja Material", "Advertisement", "Transportation", "Cultural Program", "Miscellaneous",
].map((c) => ({ label: c, value: c }));
const MODES = ["Cash", "UPI", "Bank Transfer", "Other"].map((m) => ({ label: m, value: m }));

export default function AddExpense() {
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { expenseId } = useLocalSearchParams<{ expenseId?: string }>();
  const isEdit = !!expenseId;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [mode, setMode] = useState<string | null>("Cash");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expenseId) return;
    api.get(`/expenses/${expenseId}`).then((e) => {
      setTitle(e.title || "");
      setCategory(e.category || null);
      setAmount(e.amount ? String(e.amount) : "");
      setVendor(e.vendor || "");
      setPaidBy(e.paid_by || "");
      setMode(e.payment_mode || "Cash");
      setDescription(e.description || "");
    }).catch(() => show("Could not load expense", "error"));
  }, [expenseId, show]);

  const submit = async () => {
    if (!title.trim()) return show("Enter expense title", "error");
    if (!category) return show("Select a category", "error");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return show("Enter a valid amount", "error");
    setLoading(true);
    const body = {
      title, category, amount: amt, vendor: vendor || null,
      paid_by: paidBy || null, payment_mode: mode, description: description || null,
    };
    try {
      if (isEdit) {
        await api.put(`/expenses/${expenseId}`, body);
        show("Expense updated successfully", "success");
      } else {
        await api.post("/expenses", body);
        show("Expense added successfully", "success");
      }
      router.back();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Failed to save expense", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>{isEdit ? "Edit Expense" : "Add Expense"}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="close-modal">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Title" placeholder="e.g. Flower decoration" icon="pricetag-outline" value={title} onChangeText={setTitle} testID="expense-title-input" />
        <Picker label="Category" placeholder="Select category" value={category} options={CATEGORIES} onChange={setCategory} icon="grid-outline" testID="expense-category-picker" />
        <Field label="Amount (₹)" placeholder="0" icon="cash-outline" keyboardType="numeric" value={amount} onChangeText={setAmount} testID="expense-amount-input" />
        <Field label="Vendor (optional)" placeholder="Vendor name" value={vendor} onChangeText={setVendor} testID="expense-vendor-input" />
        <Field label="Paid By (optional)" placeholder="Person who paid" value={paidBy} onChangeText={setPaidBy} testID="expense-paidby-input" />
        <Picker label="Payment Mode" value={mode} options={MODES} onChange={setMode} icon="wallet-outline" testID="expense-mode-picker" />
        <Field label="Description (optional)" placeholder="Notes" value={description} onChangeText={setDescription} multiline testID="expense-description-input" />

        <Button title={isEdit ? "Save Changes" : "Add Expense"} onPress={submit} loading={loading} icon="checkmark" testID="expense-submit-button" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
});
