import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";

// -------------------- Button --------------------
export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger" | "success";
  loading?: boolean;
  disabled?: boolean;
  icon?: any;
  testID?: string;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary"
      ? colors.brand
      : variant === "danger"
      ? colors.error
      : variant === "success"
      ? colors.success
      : variant === "secondary"
      ? colors.surfaceTertiary
      : "transparent";
  const fg =
    variant === "secondary"
      ? colors.brand
      : variant === "outline"
      ? colors.brand
      : "#FFFFFF";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1 },
        variant === "outline" && { borderWidth: 1.5, borderColor: colors.brand },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// -------------------- Card --------------------
export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

// -------------------- Field --------------------
export function Field({
  label,
  error,
  icon,
  ...props
}: TextInputProps & { label?: string; error?: string; icon?: any }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrap, error ? { borderColor: colors.error } : null]}>
        {icon && <Ionicons name={icon} size={18} color={colors.muted} style={{ marginRight: spacing.sm }} />}
        <TextInput
          placeholderTextColor={colors.muted}
          style={styles.input}
          {...props}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// -------------------- Badge --------------------
export function Badge({ label, tone = "neutral" }: { label: string; tone?: "success" | "warning" | "error" | "neutral" | "brand" }) {
  const map: Record<string, { bg: string; fg: string }> = {
    success: { bg: "#DCFCE7", fg: "#166534" },
    warning: { bg: "#FEF9C3", fg: "#854D0E" },
    error: { bg: "#FEE2E2", fg: "#991B1B" },
    brand: { bg: colors.surfaceTertiary, fg: colors.brand },
    neutral: { bg: colors.divider, fg: colors.info },
  };
  const c = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

// -------------------- Progress bar --------------------
export function ProgressBar({ percent, height = 10 }: { percent: number; height?: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={[styles.progressTrack, { height }]}>
      <View style={[styles.progressFill, { width: `${p}%`, height }]} />
    </View>
  );
}

// -------------------- Chip row --------------------
export function ChipRow({
  options,
  value,
  onChange,
  testID,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  testID?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipRow}
      contentContainerStyle={styles.chipRowContent}
      testID={testID}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            testID={`chip-${opt.value}`}
            onPress={() => onChange(opt.value)}
            style={[styles.chip, active ? styles.chipActive : null]}
          >
            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// -------------------- Empty state --------------------
export function EmptyState({
  icon = "cube-outline",
  title,
  subtitle,
}: {
  icon?: any;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty} testID="empty-state">
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={40} color={colors.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

// -------------------- Skeleton --------------------
export function Skeleton({ height = 72, style }: { height?: number; style?: ViewStyle }) {
  return <View style={[styles.skeleton, { height }, style]} />;
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: { fontFamily: fonts.semibold, fontSize: fontSize.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    paddingVertical: 12,
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  progressTrack: {
    backgroundColor: colors.divider,
    borderRadius: radius.pill,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: { backgroundColor: colors.success, borderRadius: radius.pill },
  chipRow: { maxHeight: 56 },
  chipRowContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  chipTextActive: { color: "#FFFFFF" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing["3xl"], paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface, textAlign: "center" },
  emptySub: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.muted, textAlign: "center", marginTop: spacing.sm },
  skeleton: { backgroundColor: colors.divider, borderRadius: radius.md, marginBottom: spacing.md },
});
