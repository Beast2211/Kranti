import React, { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Badge, Button, ChipRow, EmptyState, Skeleton } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api, ApiError } from "@/src/api/client";
import { fileUrl } from "@/src/api/upload";
import { useToast } from "@/src/components/Toast";
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
  const { isAdmin, token } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

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

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.del(`/events/${confirm.id}`);
      show("Event deleted", "success");
      setConfirm(null);
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const d = new Date(item.event_date);
    const img = fileUrl(item.image_url, token);
    return (
      <View style={styles.card} testID={`event-card-${item.id}`}>
        {img ? <Image source={{ uri: img }} style={styles.banner} contentFit="cover" transition={200} /> : null}
        <View style={styles.cardRow}>
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
        {isAdmin && (
          <View style={styles.adminRow}>
            <Pressable style={styles.actionBtn} onPress={() => router.push(`/add-event?eventId=${item.id}`)} testID={`edit-event-${item.id}`}>
              <Ionicons name="create-outline" size={16} color={colors.brand} />
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => setConfirm(item)} testID={`delete-event-${item.id}`}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
            </Pressable>
          </View>
        )}
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

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirm(null)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <View style={styles.confirmIcon}><Ionicons name="trash" size={26} color={colors.error} /></View>
            <Text style={styles.confirmTitle}>Delete event?</Text>
            <Text style={styles.confirmSub} numberOfLines={2}>"{confirm?.event_name}" will be removed from the schedule.</Text>
            <View style={styles.confirmActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setConfirm(null)} style={{ flex: 1 }} testID="cancel-delete-event" />
              <Button title="Delete" variant="danger" onPress={doDelete} loading={deleting} style={{ flex: 1 }} testID="confirm-delete-event" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadow.card },
  banner: { width: "100%", height: 150, backgroundColor: colors.surfaceTertiary },
  cardRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  dateBadge: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  dateDay: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, color: colors.brand },
  dateMon: { fontFamily: fonts.semibold, fontSize: 11, color: colors.onSurfaceTertiary, textTransform: "uppercase" },
  name: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  adminRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, marginTop: -spacing.xs },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  deleteBtn: { borderColor: colors.error },
  actionText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.brand },
  fab: { position: "absolute", right: spacing.lg, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", ...shadow.raised },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, width: "100%", maxWidth: 400, alignItems: "center" },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  confirmTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  confirmSub: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl },
  confirmActions: { flexDirection: "row", gap: spacing.md, width: "100%" },
});
