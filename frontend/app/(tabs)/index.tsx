import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { useFetch } from "@/src/hooks/useFetch";
import { fileUrl } from "@/src/api/upload";
import { Card, ProgressBar, EmptyState } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing, shadow, HERO_BG } from "@/src/theme";
import { formatINR, formatDate, timeAgo, eventDateParts, formatEventDate } from "@/src/utils/format";

interface Dash {
  total_target: number;
  total_collected: number;
  total_pending: number;
  total_advance: number;
  total_expenses: number;
  net_balance: number;
  member_count: number;
  pending_approvals: number;
  collection_percent: number;
  upcoming_events: any[];
  recent_activity: any[];
}

const ACTION_ICONS: Record<string, any> = {
  VARGANI_PAYMENT_ADDED: "cash",
  EXPENSE_ADDED: "receipt",
  EVENT_CREATED: "calendar",
  MEMBER_APPROVED: "checkmark-circle",
  MEMBER_CREATED: "person-add",
  MEMBER_REJECTED: "close-circle",
  ADMIN_CREATED: "shield",
};

export default function Dashboard() {
  const { user, isAdmin, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useFetch<Dash>("/dashboard");

  const d = data;

  const quickActions = [
    { label: "Add Vargani", icon: "cash", route: "/add-payment", color: colors.success },
    { label: "Add Expense", icon: "receipt", route: "/add-expense", color: colors.error },
    { label: "Add Member", icon: "person-add", route: "/add-member", color: colors.brand },
    { label: "Add Event", icon: "calendar", route: "/add-event", color: colors.brandSecondary },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.brand} />}
      testID="dashboard-scroll"
    >
      {/* Hero */}
      <View style={styles.heroWrap}>
        <Image source={{ uri: HERO_BG }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
        <LinearGradient
          colors={["rgba(234,88,12,0.82)", "rgba(120,53,15,0.92)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={styles.brandHeading}>Kranti Ganesh Mandal 2026</Text>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.greeting}>Namaste 🙏</Text>
              <Text style={styles.heroName}>{user?.full_name || "Member"}</Text>
            </View>
            <Pressable
              style={styles.bellBtn}
              onPress={() => router.push("/notifications")}
              testID="dashboard-notifications-button"
            >
              <Ionicons name="notifications-outline" size={22} color="#FFF" />
            </Pressable>
          </View>

          <BlurView intensity={30} tint="light" style={styles.glassCard}>
            <Text style={styles.glassLabel}>Total Vargani Target</Text>
            <Text style={styles.glassTarget} testID="dashboard-total-target">
              {formatINR(d?.total_target ?? 0)}
            </Text>
            <View style={styles.glassRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.glassSubLabel}>Collected</Text>
                <Text style={[styles.glassSubValue, { color: "#DCFCE7" }]} testID="dashboard-collected">
                  {formatINR(d?.total_collected ?? 0)}
                </Text>
              </View>
              <View style={styles.glassDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.glassSubLabel}>Pending</Text>
                <Text style={[styles.glassSubValue, { color: "#FEF9C3" }]} testID="dashboard-pending">
                  {formatINR(d?.total_pending ?? 0)}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar percent={d?.collection_percent ?? 0} />
              <Text style={styles.glassPercent}>{d?.collection_percent ?? 0}% collected</Text>
            </View>
          </BlurView>
        </View>
      </View>

      {loading && !d ? (
        <View style={{ padding: spacing["3xl"] }}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : error ? (
        <View style={{ padding: spacing.xl }}>
          <EmptyState icon="cloud-offline-outline" title="Couldn't load dashboard" subtitle={error} />
          <Pressable onPress={reload} style={styles.retry} testID="dashboard-retry">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.body}>
          {/* KPI grid */}
          <View style={styles.kpiGrid}>
            <KpiCard icon="wallet" label="Net Balance" value={formatINR(d!.net_balance)} tint={d!.net_balance >= 0 ? colors.success : colors.error} />
            <KpiCard icon="trending-down" label="Total Expenses" value={formatINR(d!.total_expenses)} tint={colors.error} />
            <KpiCard icon="people" label="Active Members" value={String(d!.member_count)} tint={colors.brand} />
            <KpiCard icon="pie-chart" label="Collection" value={`${d!.collection_percent}%`} tint={colors.brandSecondary} />
          </View>

          {/* Quick actions (admin) */}
          {isAdmin && (
            <>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionGrid}>
                {quickActions.map((a) => (
                  <Pressable
                    key={a.label}
                    style={styles.actionBtn}
                    onPress={() => router.push(a.route as any)}
                    testID={`quick-action-${a.label.replace(/\s/g, "-").toLowerCase()}`}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: a.color + "1A" }]}>
                      <Ionicons name={a.icon} size={22} color={a.color} />
                    </View>
                    <Text style={styles.actionLabel}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Pending approvals banner */}
          {isAdmin && d!.pending_approvals > 0 && (
            <Pressable onPress={() => router.push("/approvals")} testID="pending-approvals-banner">
              <Card style={styles.approvalBanner}>
                <Ionicons name="alert-circle" size={22} color={colors.brand} />
                <Text style={styles.approvalText}>
                  {d!.pending_approvals} member{d!.pending_approvals > 1 ? "s" : ""} awaiting approval
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.brand} />
              </Card>
            </Pressable>
          )}

          {/* Upcoming events */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <Pressable onPress={() => router.push("/events")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {d!.upcoming_events.length === 0 ? (
            <Card><Text style={styles.mutedText}>No upcoming events scheduled.</Text></Card>
          ) : (
            d!.upcoming_events.map((ev) => (
              <Card key={ev.id} style={styles.eventCard}>
                {fileUrl(ev.image_url, token) ? (
                  <Image source={{ uri: fileUrl(ev.image_url, token)! }} style={styles.eventThumb} contentFit="cover" transition={200} />
                ) : (
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateDay}>{eventDateParts(ev.event_date).day}</Text>
                    <Text style={styles.dateMon}>{eventDateParts(ev.event_date).month}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventName} numberOfLines={1}>{ev.event_name}</Text>
                  <Text style={styles.eventMeta} numberOfLines={1}>
                    {formatEventDate(ev.event_date)} · {ev.location || "Mandal"} {ev.start_time ? `· ${ev.start_time}` : ""}
                  </Text>
                </View>
              </Card>
            ))
          )}

          {/* Recent activity */}
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {d!.recent_activity.length === 0 ? (
            <Card><Text style={styles.mutedText}>No recent activity.</Text></Card>
          ) : (
            <Card style={{ paddingVertical: spacing.xs }}>
              {d!.recent_activity.map((a, i) => (
                <View key={a.id} style={[styles.activityRow, i === d!.recent_activity.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.activityIcon}>
                    <Ionicons name={ACTION_ICONS[a.action] || "ellipse"} size={16} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityText} numberOfLines={1}>{a.details || a.action}</Text>
                    <Text style={styles.activityMeta}>{a.user_name} · {timeAgo(a.created_at)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function KpiCard({ icon, label, value, tint }: { icon: any; label: string; value: string; tint: string }) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: tint + "1A" }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  brandHeading: { fontFamily: fonts.displayBold, fontSize: fontSize.lg, color: "#FFF", textAlign: "center", marginBottom: spacing.md, letterSpacing: 0.3 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  greeting: { fontFamily: fonts.regular, fontSize: fontSize.base, color: "rgba(255,255,255,0.85)" },
  heroName: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: "#FFF" },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  glassCard: { borderRadius: radius.lg, padding: spacing.lg, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  glassLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: "rgba(255,255,255,0.9)", textTransform: "uppercase", letterSpacing: 0.8 },
  glassTarget: { fontFamily: fonts.displayBold, fontSize: 34, color: "#FFF", marginTop: spacing.xs },
  glassRow: { flexDirection: "row", marginTop: spacing.lg, alignItems: "center" },
  glassDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: spacing.md },
  glassSubLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: "rgba(255,255,255,0.8)" },
  glassSubValue: { fontFamily: fonts.displayMedium, fontSize: fontSize.xl, marginTop: 2 },
  glassPercent: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: "rgba(255,255,255,0.9)", marginTop: spacing.sm },
  body: { padding: spacing.lg, gap: spacing.md },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  kpiCard: {
    width: "47.5%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  kpiValue: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, color: colors.onSurface },
  kpiLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface, marginTop: spacing.sm },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  seeAll: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.brand },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  actionBtn: {
    width: "47.5%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface, flexShrink: 1 },
  approvalBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderColor: colors.brandTertiary },
  approvalText: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurfaceTertiary },
  eventCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dateBadge: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  eventThumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  dateDay: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, color: colors.brand },
  dateMon: { fontFamily: fonts.semibold, fontSize: 11, color: colors.onSurfaceTertiary, textTransform: "uppercase" },
  eventName: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.onSurface },
  eventMeta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  activityIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  activityText: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurface },
  activityMeta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  mutedText: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted },
  retry: { alignSelf: "center", backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  retryText: { color: "#FFF", fontFamily: fonts.semibold },
});
