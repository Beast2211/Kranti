import React, { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { AppHeader } from "@/src/components/AppHeader";
import { Card, ChipRow, ProgressBar } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { api, getToken } from "@/src/api/client";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";
import { formatINR } from "@/src/utils/format";

const TABS = [
  { label: "Financial", value: "financial" },
  { label: "Vargani", value: "vargani" },
  { label: "Expenses", value: "expenses" },
  { label: "Events", value: "events" },
];

const CAT_COLORS = ["#EA580C", "#F97316", "#EAB308", "#16A34A", "#0891B2", "#7C3AED", "#DB2777", "#DC2626", "#65A30D", "#78716C"];

export default function Reports() {
  const { isAdmin } = useAuth();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("financial");
  const [vargani, setVargani] = useState<any>(null);
  const [expenses, setExpenses] = useState<any>(null);
  const [events, setEvents] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [v, e, ev] = await Promise.all([
        api.get("/reports/vargani"),
        api.get("/reports/expenses"),
        api.get("/reports/events"),
      ]);
      setVargani(v);
      setExpenses(e);
      setEvents(ev);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const exportCsv = async (type: "vargani" | "expenses") => {
    try {
      const url = `${api.baseUrl}/reports/${type}/export`;
      const token = await getToken();
      if (Platform.OS === "web") {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `${type}_report.csv`;
        a.click();
        URL.revokeObjectURL(href);
        show("Report downloaded", "success");
        return;
      }
      const fileUri = FileSystem.cacheDirectory + `${type}_report.csv`;
      const dl = await FileSystem.downloadAsync(url, fileUri, { headers: { Authorization: `Bearer ${token}` } });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dl.uri, { mimeType: "text/csv" });
      } else {
        show("Saved to app storage", "success");
      }
    } catch {
      show("Export failed", "error");
    }
  };

  const netBalance = (vargani?.total_collected || 0) - (expenses?.total || 0);
  const maxCat = expenses?.by_category?.[0]?.amount || 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Reports" subtitle="Insights & summaries" back />
      <ChipRow options={TABS} value={tab} onChange={setTab} testID="report-tabs" />
      {loading ? (
        <View style={{ padding: spacing["3xl"] }}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + 90, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {tab === "financial" && (
            <>
              <Card style={styles.financeHero}>
                <Text style={styles.heroLabel}>Net Balance</Text>
                <Text style={[styles.heroValue, { color: netBalance >= 0 ? "#FFF" : "#FECACA" }]} testID="report-net-balance">{formatINR(netBalance)}</Text>
                <Text style={styles.heroSub}>Collections minus expenses</Text>
              </Card>
              <View style={styles.dual}>
                <StatBox icon="arrow-up-circle" label="Collected" value={formatINR(vargani?.total_collected || 0)} tint={colors.success} />
                <StatBox icon="arrow-down-circle" label="Expenses" value={formatINR(expenses?.total || 0)} tint={colors.error} />
              </View>
              <View style={styles.dual}>
                <StatBox icon="flag" label="Target" value={formatINR(vargani?.total_target || 0)} tint={colors.brand} />
                <StatBox icon="time" label="Pending" value={formatINR(vargani?.total_pending || 0)} tint={colors.warning} />
              </View>
            </>
          )}

          {tab === "vargani" && vargani && (
            <>
              <Card>
                <Text style={styles.cardTitle}>Collection Status</Text>
                <View style={styles.statRow}><Text style={styles.statLabel}>Paid members</Text><Text style={[styles.statVal, { color: colors.success }]}>{vargani.paid_count}</Text></View>
                <View style={styles.statRow}><Text style={styles.statLabel}>Partially paid</Text><Text style={[styles.statVal, { color: colors.warning }]}>{vargani.partial_count}</Text></View>
                <View style={styles.statRow}><Text style={styles.statLabel}>Pending members</Text><Text style={[styles.statVal, { color: colors.error }]}>{vargani.pending_count}</Text></View>
              </Card>
              <Card>
                <Text style={styles.cardTitle}>Totals</Text>
                <View style={styles.statRow}><Text style={styles.statLabel}>Target</Text><Text style={styles.statVal}>{formatINR(vargani.total_target)}</Text></View>
                <View style={styles.statRow}><Text style={styles.statLabel}>Collected</Text><Text style={styles.statVal}>{formatINR(vargani.total_collected)}</Text></View>
                <View style={styles.statRow}><Text style={styles.statLabel}>Advance</Text><Text style={styles.statVal}>{formatINR(vargani.total_advance)}</Text></View>
                <View style={styles.statRow}><Text style={styles.statLabel}>Pending</Text><Text style={styles.statVal}>{formatINR(vargani.total_pending)}</Text></View>
                <View style={{ marginTop: spacing.sm }}>
                  <ProgressBar percent={vargani.total_target > 0 ? (vargani.total_collected / vargani.total_target) * 100 : 0} />
                </View>
              </Card>
              {isAdmin && <ExportBtn onPress={() => exportCsv("vargani")} label="Export Vargani CSV" />}
            </>
          )}

          {tab === "expenses" && expenses && (
            <>
              <Card style={styles.financeHero}>
                <Text style={styles.heroLabel}>Total Expenses</Text>
                <Text style={styles.heroValue}>{formatINR(expenses.total)}</Text>
                <Text style={styles.heroSub}>{expenses.count} transactions</Text>
              </Card>
              <Card>
                <Text style={styles.cardTitle}>By Category</Text>
                {expenses.by_category.length === 0 ? (
                  <Text style={styles.emptyText}>No expenses yet.</Text>
                ) : (
                  expenses.by_category.map((c: any, i: number) => (
                    <View key={c.category} style={{ marginBottom: spacing.md }}>
                      <View style={styles.catRow}>
                        <Text style={styles.catName}>{c.category}</Text>
                        <Text style={styles.catAmount}>{formatINR(c.amount)}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(c.amount / maxCat) * 100}%`, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
                      </View>
                    </View>
                  ))
                )}
              </Card>
              {isAdmin && <ExportBtn onPress={() => exportCsv("expenses")} label="Export Expenses CSV" />}
            </>
          )}

          {tab === "events" && events && (
            <View style={styles.dual}>
              <StatBox icon="calendar" label="Upcoming" value={String(events.upcoming || 0)} tint={colors.brand} />
              <StatBox icon="checkmark-done" label="Completed" value={String(events.completed || 0)} tint={colors.success} />
              <StatBox icon="close-circle" label="Cancelled" value={String(events.cancelled || 0)} tint={colors.error} />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StatBox({ icon, label, value, tint }: { icon: any; label: string; value: string; tint: string }) {
  return (
    <View style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: tint + "1A" }]}><Ionicons name={icon} size={18} color={tint} /></View>
      <Text style={styles.statBoxValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

function ExportBtn({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable style={styles.exportBtn} onPress={onPress} testID="export-csv-button">
      <Ionicons name="download-outline" size={18} color={colors.brand} />
      <Text style={styles.exportText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  financeHero: { backgroundColor: colors.brand, borderColor: colors.brand, alignItems: "flex-start" },
  heroLabel: { fontFamily: fonts.medium, fontSize: fontSize.base, color: "rgba(255,255,255,0.85)" },
  heroValue: { fontFamily: fonts.displayBold, fontSize: 34, color: "#FFF", marginVertical: spacing.xs },
  heroSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: "rgba(255,255,255,0.8)" },
  dual: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statBox: { flex: 1, minWidth: "30%", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  statBoxValue: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, color: colors.onSurface },
  statBoxLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.md },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  statLabel: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  statVal: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, color: colors.onSurface },
  catRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  catName: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  catAmount: { fontFamily: fonts.displayMedium, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  barTrack: { height: 8, backgroundColor: colors.divider, borderRadius: radius.pill, overflow: "hidden" },
  barFill: { height: 8, borderRadius: radius.pill },
  emptyText: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted },
  exportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: colors.surfaceTertiary },
  exportText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.brand },
});
