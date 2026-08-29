import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { AppHeader } from "@/src/components/AppHeader";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { api, ApiError } from "@/src/api/client";
import { colors, fonts, fontSize, spacing } from "@/src/theme";

export default function ChangePassword() {
  const { show } = useToast();
  const { logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!current) return show("Enter current password", "error");
    if (next.length < 6) return show("New password must be at least 6 characters", "error");
    if (next !== confirm) return show("Passwords do not match", "error");
    setLoading(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      show("Password changed. Please sign in again.", "success");
      await logout();
      router.replace("/(auth)/login");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Failed to change password", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppHeader title="Change Password" back />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sub}>For security, you will be signed out after changing your password.</Text>
        <Field label="Current Password" placeholder="Current password" icon="lock-closed-outline" secureTextEntry value={current} onChangeText={setCurrent} testID="current-password-input" />
        <Field label="New Password" placeholder="Min. 6 characters" icon="key-outline" secureTextEntry value={next} onChangeText={setNext} testID="new-password-input" />
        <Field label="Confirm New Password" placeholder="Re-enter new password" icon="key-outline" secureTextEntry value={confirm} onChangeText={setConfirm} testID="confirm-password-input" />
        <Button title="Update Password" onPress={submit} loading={loading} testID="change-password-submit" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, marginBottom: spacing.xl },
});
