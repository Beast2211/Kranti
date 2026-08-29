import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { AppHeader } from "@/src/components/AppHeader";
import { Button, Field, Card } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api, ApiError } from "@/src/api/client";
import { colors, fonts, fontSize, spacing } from "@/src/theme";

export default function Register() {
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (fullName.trim().length < 2) return show("Enter your full name", "error");
    if (mobile.replace(/\D/g, "").length < 10) return show("Enter a valid 10-digit mobile", "error");
    if (password.length < 6) return show("Password must be at least 6 characters", "error");
    if (password !== confirm) return show("Passwords do not match", "error");
    setLoading(true);
    try {
      await api.post("/auth/register", { full_name: fullName.trim(), mobile, password });
      show("Registration submitted for approval", "success");
      router.replace("/(auth)/login");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppHeader title="Create Account" subtitle="Join the Mandal" back />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.surfaceTertiary, borderColor: colors.brandTertiary }}>
          <Text style={styles.note}>
            After registering, an administrator must approve your account before you can sign in.
          </Text>
        </Card>

        <Field label="Full Name" placeholder="e.g. Ramesh Kulkarni" icon="person-outline" value={fullName} onChangeText={setFullName} testID="register-name-input" />
        <Field label="Mobile Number" placeholder="10-digit mobile" icon="call-outline" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} testID="register-mobile-input" />
        <Field label="Password" placeholder="Min. 6 characters" icon="lock-closed-outline" secureTextEntry value={password} onChangeText={setPassword} testID="register-password-input" />
        <Field label="Confirm Password" placeholder="Re-enter password" icon="lock-closed-outline" secureTextEntry value={confirm} onChangeText={setConfirm} testID="register-confirm-input" />

        <Button title="Register" onPress={onSubmit} loading={loading} testID="register-submit-button" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onBrandTertiary, lineHeight: 20 },
});
