import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button, Field } from "@/src/components/ui";
import { Picker } from "@/src/components/Picker";
import { DatePickerField } from "@/src/components/DatePickerField";
import { useToast } from "@/src/components/Toast";
import { api, ApiError } from "@/src/api/client";
import { uploadImage, fileUrl } from "@/src/api/upload";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

const STATUSES = ["Upcoming", "Completed", "Cancelled"].map((s) => ({ label: s, value: s }));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function AddEvent() {
  const { show } = useToast();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const isEdit = !!eventId;
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>("Upcoming");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    api.get(`/events/${eventId}`).then((e) => {
      setName(e.event_name || "");
      setDate((e.event_date || "").slice(0, 10));
      setStartTime(e.start_time || "");
      setEndTime(e.end_time || "");
      setLocation(e.location || "");
      setOrganizer(e.organizer || "");
      setDescription(e.description || "");
      setStatus(e.status || "Upcoming");
      if (e.image_url) {
        setImagePath(e.image_url);
        setLocalPreview(fileUrl(e.image_url, token));
      }
    }).catch(() => show("Could not load event", "error"));
  }, [eventId, token, show]);

  const pickImage = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      status = req.status;
      if (status !== "granted") {
        if (!req.canAskAgain) {
          show("Enable photo access in Settings to add a poster", "error");
          Linking.openSettings();
        } else {
          show("Photo permission is needed to add a poster", "error");
        }
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setLocalPreview(asset.uri);
    setUploading(true);
    try {
      const path = await uploadImage(asset.uri);
      setImagePath(path);
      show("Poster uploaded", "success");
    } catch (e) {
      setLocalPreview(null);
      show(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) return show("Enter event name", "error");
    if (!DATE_RE.test(date)) return show("Enter date as YYYY-MM-DD", "error");
    setLoading(true);
    const body = {
      event_name: name, event_date: date, start_time: startTime || null,
      end_time: endTime || null, location: location || null,
      organizer: organizer || null, description: description || null,
      image_url: imagePath, status,
    };
    try {
      if (isEdit) {
        await api.put(`/events/${eventId}`, body);
        show("Event updated successfully", "success");
      } else {
        await api.post("/events", body);
        show("Event created successfully", "success");
      }
      router.back();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Failed to save event", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>{isEdit ? "Edit Event" : "Add Event"}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="close-modal">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.photoLabel}>Event Poster / Photo</Text>
        <Pressable style={styles.photoBox} onPress={pickImage} disabled={uploading} testID="event-photo-picker">
          {localPreview ? (
            <>
              <Image source={{ uri: localPreview }} style={styles.photoPreview} contentFit="cover" />
              {uploading ? (
                <View style={styles.photoOverlay}><ActivityIndicator color="#FFF" /></View>
              ) : (
                <View style={styles.photoEdit}><Ionicons name="camera" size={16} color="#FFF" /><Text style={styles.photoEditText}>Change</Text></View>
              )}
            </>
          ) : (
            <View style={styles.photoEmpty}>
              <Ionicons name="image-outline" size={30} color={colors.brand} />
              <Text style={styles.photoEmptyText}>Tap to add a poster</Text>
            </View>
          )}
        </Pressable>

        <Field label="Event Name" placeholder="e.g. Ganpati Sthapana" icon="calendar-outline" value={name} onChangeText={setName} testID="event-name-input" />
        <DatePickerField label="Event Date" value={date} onChange={setDate} testID="event-date-input" />
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

        <Button title={isEdit ? "Save Changes" : "Create Event"} onPress={submit} loading={loading} icon="checkmark" testID="event-submit-button" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  rowSplit: { flexDirection: "row", gap: spacing.md },
  photoLabel: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.sm },
  photoBox: { height: 170, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", marginBottom: spacing.lg, backgroundColor: colors.surfaceSecondary },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  photoEmptyText: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.muted },
  photoPreview: { width: "100%", height: "100%" },
  photoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  photoEdit: { position: "absolute", right: spacing.md, bottom: spacing.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  photoEditText: { color: "#FFF", fontFamily: fonts.semibold, fontSize: fontSize.sm },
});
