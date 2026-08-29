import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button, Field } from "@/src/components/ui";
import { Picker } from "@/src/components/Picker";
import { useToast } from "@/src/components/Toast";
import { api, ApiError } from "@/src/api/client";
import { colors, fonts, fontSize, spacing } from "@/src/theme";

const STATUSES = ["Upcoming", "Completed", "Cancelled"].map((s) => ({ label: s, value: s }));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function AddEvent() {
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>("Upcoming");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim()) return show("Enter event name", "error");
    if (!DATE_RE.test(date)) return show("Enter date as YYYY-MM-DD", "error");
    setLoading(true);
    try {
      await api.post("/events", {
        event_name: name, event_date: date, start_time: startTime || null,
        end_time: endTime || null, location: location || null,
        organizer: organizer || null, description: description || null, status,
      });
      show("Event created successfully", "success");
      router.back();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Failed to create event", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Add Event</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="close-modal">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Event Name" placeholder="e.g. Ganpati Sthapana" icon="calendar-outline" value={name} onChangeText={setName} testID="event-name-input" />
        <Field label="Event Date" placeholder="YYYY-MM-DD" icon="today-outline" value={date} onChangeText={setDate} testID="event-date-input" />
        <View style={styles.rowSplit}>
          <View style={{ flex: 1 }}>
            <Field label="Start Time" placeholder="10:00 AM" value={startTime} onChangeText={setStartTime} testID="event-start-input" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="End Time" placeholder="1:00 PM" value={endTime} onChangeText={setEndTime} testID="event-end-input" />
          </View>
        </View>
        <Field label="Location" placeholder="Venue" icon="location-outline" value={location} onChangeText={setLocation} testID="event-location-input" />
        <Field label="Organizer" placeholder="Organizer name" icon="person-outline" value={organizer} onChangeText={setOrganizer} testID="event-organizer-input" />
        <Picker label="Status" value={status} options={STATUSES} onChange={setStatus} icon="flag-outline" testID="event-status-picker" />
        <Field label="Description (optional)" placeholder="Details" value={description} onChangeText={setDescription} multiline testID="event-description-input" />

        <Button title="Create Event" onPress={submit} loading={loading} icon="checkmark" testID="event-submit-button" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  rowSplit: { flexDirection: "row", gap: spacing.md },
});
