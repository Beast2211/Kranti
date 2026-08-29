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

export default function Forgot() {
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    if (!identifier.trim()) return show("Enter your User ID or mobile", "error");
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot", { identifier: identifier.trim() });
      if (res.recovery_code) {
        setCode(res.recovery_code);
        show("Recovery code generated", "success");
      } else {
        show(res.message || "If the account exists, a code was generated", "info");
      }
      setStep(2);
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Request failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const doReset = async () => {
    if (!code.trim()) return show("Enter the recovery code", "error");
    if (newPassword.length < 6) return show("Password must be at least 6 characters", "error");
    setLoading(true);
    try {
      await api.post("/auth/reset", { token: code.trim(), new_password: newPassword });
      show("Password reset successfully", "success");
      router.replace("/(auth)/login");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Reset failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AppHeader title="Reset Password" back />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <>
            <Text style={styles.sub}>Enter your User ID or mobile number to receive a recovery code.</Text>
            <Field label="User ID / Mobile" placeholder="Enter identifier" icon="person-outline" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} testID="forgot-identifier-input" />
            <Button title="Get Recovery Code" onPress={requestCode} loading={loading} testID="forgot-request-button" />
          </>
        ) : (
          <>
            {code ? (
              <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.surfaceTertiary, borderColor: colors.brandTertiary }}>
                <Text style={styles.note}>Your recovery code:</Text>
                <Text style={styles.code} testID="recovery-code">{code}</Text>
              </Card>
            ) : null}
            <Field label="Recovery Code" placeholder="Enter code" autoCapitalize="characters" value={code} onChangeText={setCode} testID="forgot-code-input" />
            <Field label="New Password" placeholder="Min. 6 characters" icon="lock-closed-outline" secureTextEntry value={newPassword} onChangeText={setNewPassword} testID="forgot-newpassword-input" />
            <Button title="Reset Password" onPress={doReset} loading={loading} testID="forgot-reset-button" />
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, marginBottom: spacing.xl },
  note: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onBrandTertiary },
  code: { fontFamily: fonts.displayBold, fontSize: fontSize["2xl"], color: colors.brand, letterSpacing: 3, marginTop: spacing.sm },
});
