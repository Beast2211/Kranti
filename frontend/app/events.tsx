import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Badge, ChipRow, EmptyState, Skeleton } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";
import { formatDate } from "@/src/utils/format";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Upcoming", value: "Upcoming" },
  { label: "Completed", value: "Completed" },
  { label: "Cancelled", value: "Cancelled" },
];

const STATUS_TONE: Record<string, any> = { Upcoming: "brand", Completed: "success", Cancelled: "error" };

export default function Events() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const q = status ? `?status=${status}` : "";
      setEvents(await api.get(`/events${q}`));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const renderItem = ({ item }: { item: any }) => {
    const d = new Date(item.event_date);
    return (
      <View style={styles.card} testID={`event-card-${item.id}`}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateDay}>{isNaN(d.getTime()) ? "—" : d.getDate()}</Text>
          <Text style={styles.dateMon}>{isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { month: "short" })}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.event_name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            <Ionicons name="location-outline" size={12} color={colors.muted} /> {item.location || "Mandal"}
          </Text>
          {item.start_time ? <Text style={styles.meta}>{item.start_time}{item.end_time ? ` - ${item.end_time}` : ""}</Text> : null}
        </View>
        <Badge label={item.status} tone={STATUS_TONE[item.status]} />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Events" subtitle="Festival schedule" back />
      <ChipRow options={FILTERS} value={status} onChange={setStatus} testID="event-filter-chips" />
      {loading ? (
        <View style={{ padding: spacing.lg }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={88} />)}</View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No events" subtitle="Scheduled events will appear here." />}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: insets.bottom + 90, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        />
      )}
      {isAdmin && (
        <Pressable style={[styles.fab, { bottom: insets.bottom + spacing.lg }]} onPress={() => router.push("/add-event")} testID="add-event-fab">
          <Ionicons name="add" size={28} color="#FFF" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  dateBadge: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  dateDay: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, color: colors.brand },
  dateMon: { fontFamily: fonts.semibold, fontSize: 11, color: colors.onSurfaceTertiary, textTransform: "uppercase" },
  name: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  fab: { position: "absolute", right: spacing.lg, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", ...shadow.raised },
});
