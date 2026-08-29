import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button, Field } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { ApiError } from "@/src/api/client";
import { colors, fonts, fontSize, radius, spacing, GANESHA_IMG } from "@/src/theme";

export default function Login() {
  const { login } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!identifier.trim() || !password) {
      show("Please enter your credentials", "error");
      return;
    }
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      show("Welcome back!", "success");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Login failed";
      show(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <LinearGradient
        colors={[colors.brand, colors.brandPrimary, colors.brandSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}
      >
        <Image source={{ uri: GANESHA_IMG }} style={styles.logo} />
        <Text style={styles.brandTitle}>Kranti Ganesh Mandal</Text>
        <Text style={styles.brandYear}>2026 · Management</Text>
      </LinearGradient>

      <View style={styles.form}>
        <Text style={styles.welcome}>Sign in</Text>
        <Text style={styles.sub}>Members use mobile number · Admins use User ID</Text>

        <Field
          label="User ID / Mobile Number"
          placeholder="Enter your ID or mobile"
          icon="person-outline"
          autoCapitalize="none"
          value={identifier}
          onChangeText={setIdentifier}
          testID="login-identifier-input"
        />
        <View>
          <Field
            label="Password"
            placeholder="Enter your password"
            icon="lock-closed-outline"
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
            testID="login-password-input"
          />
          <Pressable onPress={() => setShowPw((s) => !s)} style={styles.eye} hitSlop={10}>
            <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push("/(auth)/forgot")}
          style={{ alignSelf: "flex-end", marginBottom: spacing.lg }}
          testID="forgot-link"
        >
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>

        <Button title="Sign In" onPress={onSubmit} loading={loading} testID="login-submit-button" />

        <View style={styles.footer}>
          <Text style={styles.footerText}>New member? </Text>
          <Pressable onPress={() => router.push("/(auth)/register")} testID="register-link">
            <Text style={styles.link}>Register here</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingBottom: spacing["2xl"],
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.6)",
    marginBottom: spacing.md,
  },
  brandTitle: { fontFamily: fonts.displayBold, fontSize: fontSize["2xl"], color: "#FFFFFF" },
  brandYear: { fontFamily: fonts.medium, fontSize: fontSize.base, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  form: { padding: spacing.xl, paddingTop: spacing["2xl"] },
  welcome: { fontFamily: fonts.bold, fontSize: fontSize["3xl"], color: colors.onSurface },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, marginBottom: spacing.xl, marginTop: spacing.xs },
  eye: { position: "absolute", right: spacing.md, top: 38 },
  link: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.brand },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  footerText: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted },
});
