import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { ChipRow, EmptyState, Skeleton } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";
import { formatINR, formatDate } from "@/src/utils/format";

const CATEGORIES = [
  "Decoration", "Electricity", "Sound System", "Lighting", "Prasad/Food",
  "Pooja Material", "Advertisement", "Transportation", "Cultural Program", "Miscellaneous",
];
const FILTERS = [{ label: "All", value: "" }, ...CATEGORIES.map((c) => ({ label: c, value: c }))];

const CAT_ICON: Record<string, any> = {
  Decoration: "color-palette", Electricity: "flash", "Sound System": "musical-notes",
  Lighting: "bulb", "Prasad/Food": "fast-food", "Pooja Material": "flower",
  Advertisement: "megaphone", Transportation: "car", "Cultural Program": "mic", Miscellaneous: "cube",
};

export default function Expenses() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");

  const load = useCallback(async () => {
    try {
      const q = category ? `?category=${encodeURIComponent(category)}` : "";
      const [list, report] = await Promise.all([api.get(`/expenses${q}`), api.get("/reports/expenses")]);
      setExpenses(list);
      setTotal(report.total);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.row} testID={`expense-row-${item.id}`}>
      <View style={styles.rowIcon}>
        <Ionicons name={CAT_ICON[item.category] || "cube"} size={18} color={colors.error} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowMeta}>{item.category} · {formatDate(item.expense_date)}</Text>
      </View>
      <Text style={styles.rowAmount}>-{formatINR(item.amount)}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Expenses" subtitle="Festival spending" />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={styles.totalCard}>
          <View style={styles.totalIcon}>
            <Ionicons name="trending-down" size={22} color="#FFF" />
          </View>
          <View>
            <Text style={styles.totalLabel}>Total Spent</Text>
            <Text style={styles.totalValue} testID="expenses-total">{formatINR(total)}</Text>
          </View>
        </View>
      </View>
      <ChipRow options={FILTERS} value={category} onChange={setCategory} testID="expense-filter-chips" />

      {loading ? (
        <View style={{ padding: spacing.lg }}>{[1, 2, 3, 4].map((i) => <Skeleton key={i} height={64} />)}</View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No expenses logged" subtitle="Recorded expenses will appear here." />}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      {isAdmin && (
        <Pressable style={[styles.fab, { bottom: insets.bottom + 76 }]} onPress={() => router.push("/add-expense")} testID="add-expense-fab">
          <Ionicons name="add" size={28} color="#FFF" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  totalCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.lg },
  totalIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  totalLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: "rgba(255,255,255,0.7)" },
  totalValue: { fontFamily: fonts.displayBold, fontSize: fontSize["2xl"], color: "#FFF", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  rowName: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  rowMeta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  rowAmount: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, color: colors.error },
  fab: { position: "absolute", right: spacing.lg, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", ...shadow.raised },
});
