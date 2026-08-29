import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button, Field, Card } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { api, ApiError } from "@/src/api/client";
import { colors, fonts, fontSize, spacing } from "@/src/theme";

export default function AddMember() {
  const { show } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const isEdit = !!memberId;
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [target, setTarget] = useState("");
  const [advance, setAdvance] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    api.get(`/members/${memberId}`).then((m) => {
      setFullName(m.full_name || "");
      setMobile(m.mobile || "");
      setEmail(m.email || "");
      setAddress(m.address || "");
      setTarget(m.target_amount ? String(m.target_amount) : "");
      setAdvance(m.advance_amount ? String(m.advance_amount) : "");
    }).catch(() => show("Could not load member", "error"));
  }, [memberId, show]);

  const submit = async () => {
    if (fullName.trim().length < 2) return show("Enter full name", "error");
    if (!isEdit && mobile.replace(/\D/g, "").length < 10) return show("Enter a valid 10-digit mobile", "error");
    if (!isEdit && password && password.length < 6) return show("Password must be at least 6 characters", "error");
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/members/${memberId}`, {
          full_name: fullName.trim(),
          email: email || null,
          address: address || null,
          target_amount: parseFloat(target) || 0,
          advance_amount: parseFloat(advance) || 0,
        });
        show("Member updated successfully", "success");
      } else {
        await api.post("/members", {
          full_name: fullName.trim(),
          mobile,
          email: email || null,
          address: address || null,
          target_amount: parseFloat(target) || 0,
          advance_amount: parseFloat(advance) || 0,
          password: password || null,
        });
        show("Member added successfully", "success");
      }
      router.back();
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Failed to save member", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>{isEdit ? "Edit Member" : "Add Member"}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="close-modal">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Full Name" placeholder="Member name" icon="person-outline" value={fullName} onChangeText={setFullName} testID="member-name-input" />
        <Field label="Mobile Number" placeholder="10-digit mobile" icon="call-outline" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} editable={!isEdit} testID="member-mobile-input" />
        <Field label="Email (optional)" placeholder="email@example.com" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} testID="member-email-input" />
        <Field label="Address (optional)" placeholder="Address" icon="home-outline" value={address} onChangeText={setAddress} testID="member-address-input" />
        <View style={styles.rowSplit}>
          <View style={{ flex: 1 }}>
            <Field label="Vargani Target (₹)" placeholder="0" keyboardType="numeric" value={target} onChangeText={setTarget} testID="member-target-input" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Advance Paid (₹)" placeholder="0" keyboardType="numeric" value={advance} onChangeText={setAdvance} testID="member-advance-input" />
          </View>
        </View>

        <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.surfaceTertiary, borderColor: colors.brandTertiary }}>
          <Text style={styles.note}>Advance is counted as amount already collected and reduces the member's pending Vargani.</Text>
        </Card>

        {!isEdit && (
          <>
            <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.surfaceSecondary }}>
              <Text style={styles.note}>Set a password only if this member should be able to log in. Leave blank for a directory-only record.</Text>
            </Card>
            <Field label="Login Password (optional)" placeholder="Min. 6 characters" icon="lock-closed-outline" secureTextEntry value={password} onChangeText={setPassword} testID="member-password-input" />
          </>
        )}

        <Button title={isEdit ? "Save Changes" : "Add Member"} onPress={submit} loading={loading} icon="checkmark" testID="member-submit-button" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface },
  rowSplit: { flexDirection: "row", gap: spacing.md },
  note: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, lineHeight: 18 },
});
