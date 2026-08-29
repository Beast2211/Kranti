import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

export interface Option {
  label: string;
  value: string;
}

export function Picker({
  label,
  placeholder = "Select",
  value,
  options,
  onChange,
  icon,
  testID,
}: {
  label?: string;
  placeholder?: string;
  value: string | null;
  options: Option[];
  onChange: (v: string) => void;
  icon?: any;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.field} onPress={() => setOpen(true)} testID={testID}>
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} style={{ marginRight: spacing.sm }} /> : null}
        <Text style={[styles.value, !selected && { color: colors.muted }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label || "Select"}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    style={styles.option}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    testID={`option-${item.value}`}
                  >
                    <Text style={[styles.optionText, active && { color: colors.brand, fontFamily: fonts.bold }]}>
                      {item.label}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  value: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.onSurface },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing["2xl"] },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.md },
  sheetTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurface, marginBottom: spacing.md },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  optionText: { fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.onSurface },
});
