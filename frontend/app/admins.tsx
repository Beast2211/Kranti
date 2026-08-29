import React, { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/src/components/AppHeader";
import { Badge, Button, Field, EmptyState, Skeleton } from "@/src/components/ui";
import { api, ApiError } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";

export default function Admins() {
  const { show } = useToast();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setAdmins(await api.get("/admins")); } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const openCreate = () => {
    setEditing(null);
    setName(""); setUserId(""); setPassword(""); setEmail("");
    setModalOpen(true);
  };
  const openEdit = (a: any) => {
    setEditing(a);
    setName(a.full_name || ""); setUserId(a.user_id || ""); setPassword(""); setEmail(a.email || "");
    setModalOpen(true);
  };

  const save = async () => {
    if (name.trim().length < 2) return show("Enter full name", "error");
    if (!editing) {
      if (userId.trim().length < 3) return show("User ID must be at least 3 characters", "error");
      if (password.length < 6) return show("Password must be at least 6 characters", "error");
    }
    setSaving(true);
    try {
      if (editing) {
        const body: any = { full_name: name.trim(), email: email || null };
        if (password) body.password = password;
        await api.put(`/admins/${editing.id}`, body);
        show("Admin updated", "success");
      } else {
        await api.post("/admins", { full_name: name.trim(), user_id: userId.trim(), password, email: email || null });
        show("Admin created", "success");
      }
      setModalOpen(false);
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Failed to save", "error");
    } finally { setSaving(false); }
  };

  const toggleStatus = async (a: any) => {
    setBusy(a.id);
    try {
      await api.post(`/admins/${a.id}/status?active=${a.status !== "active"}`);
      show(a.status === "active" ? "Admin deactivated" : "Admin activated", "success");
      load();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Failed", "error");
    } finally { setBusy(null); }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSelf = item.id === user?.id;
    const isSuper = item.role === "super_admin";
    return (
      <View style={styles.card} testID={`admin-card-${item.id}`}>
        <View style={styles.top}>
          <View style={[styles.avatar, isSuper && { backgroundColor: colors.brand }]}>
            <Ionicons name={isSuper ? "shield-checkmark" : "shield"} size={20} color={isSuper ? "#FFF" : colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.full_name}{isSelf ? " (You)" : ""}</Text>
            <Text style={styles.meta}>@{item.user_id}</Text>
          </View>
          <Badge label={isSuper ? "Super" : item.status} tone={isSuper ? "brand" : item.status === "active" ? "success" : "error"} />
        </View>
        {!isSuper && (
          <View style={styles.actions}>
            <Pressable style={styles.editBtn} onPress={() => openEdit(item)} testID={`edit-admin-${item.id}`}>
              <Ionicons name="create-outline" size={16} color={colors.brand} />
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
            <View style={styles.statusToggle}>
              <Text style={styles.toggleLabel}>{item.status === "active" ? "Active" : "Inactive"}</Text>
              <Switch
                value={item.status === "active"}
                onValueChange={() => toggleStatus(item)}
                disabled={busy === item.id}
                trackColor={{ true: colors.success }}
                testID={`toggle-admin-${item.id}`}
              />
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <AppHeader title="Admin Management" subtitle={`${admins.length} accounts`} back
        right={<Pressable onPress={openCreate} testID="add-admin-button"><Ionicons name="add-circle" size={28} color={colors.brand} /></Pressable>}
      />
      {loading ? (
        <View style={{ padding: spacing.lg }}>{[1, 2, 3].map((i) => <Skeleton key={i} height={110} />)}</View>
      ) : (
        <FlatList
          data={admins}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          ListEmptyComponent={<EmptyState icon="shield-outline" title="No admins" />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editing ? "Edit Admin" : "Add Admin"}</Text>
              <Pressable onPress={() => setModalOpen(false)} testID="close-admin-modal"><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
            </View>
            <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled">
              <Field label="Full Name" placeholder="Admin name" icon="person-outline" value={name} onChangeText={setName} testID="admin-name-input" />
              <Field label="User ID" placeholder="login id" icon="id-card-outline" autoCapitalize="none" value={userId} onChangeText={setUserId} editable={!editing} testID="admin-userid-input" />
              <Field label="Email (optional)" placeholder="email@example.com" icon="mail-outline" autoCapitalize="none" value={email} onChangeText={setEmail} testID="admin-email-input" />
              <Field label={editing ? "New Password (optional)" : "Password"} placeholder="Min. 6 characters" icon="lock-closed-outline" secureTextEntry value={password} onChangeText={setPassword} testID="admin-password-input" />
              <Button title={editing ? "Save Changes" : "Create Admin"} onPress={save} loading={saving} testID="admin-save-button" />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, marginTop: 1 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  editBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  editText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.brand },
  statusToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  toggleLabel: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, maxHeight: "85%" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  sheetTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
});
