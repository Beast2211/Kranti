import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { parseDateLocal, formatEventDate } from "@/src/utils/format";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DatePickerField({
  label,
  placeholder = "Select date",
  value,
  onChange,
  icon = "today-outline",
  testID,
}: {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (iso: string) => void;
  icon?: any;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDateLocal(value);
  const [cursor, setCursor] = useState(() => selected ?? new Date());

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const todayIso = toIso(new Date());

  const select = (day: number) => {
    const picked = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    onChange(toIso(picked));
    setOpen(false);
  };

  const openPicker = () => {
    setCursor(selected ?? new Date());
    setOpen(true);
  };

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.field} onPress={openPicker} testID={testID}>
        <Ionicons name={icon} size={18} color={colors.muted} style={{ marginRight: spacing.sm }} />
        <Text style={[styles.value, !selected && { color: colors.muted }]} numberOfLines={1}>
          {selected ? formatEventDate(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.navRow}>
              <Pressable
                style={styles.navBtn}
                hitSlop={10}
                onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                testID="calendar-prev"
              >
                <Ionicons name="chevron-back" size={22} color={colors.brand} />
              </Pressable>
              <Text style={styles.monthTitle} testID="calendar-month">
                {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
              </Text>
              <Pressable
                style={styles.navBtn}
                hitSlop={10}
                onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                testID="calendar-next"
              >
                <Ionicons name="chevron-forward" size={22} color={colors.brand} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <Text key={i} style={styles.weekday}>{w}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {grid.map((day, i) => {
                if (day === null) return <View key={i} style={styles.dayCell} />;
                const iso = toIso(new Date(cursor.getFullYear(), cursor.getMonth(), day));
                const isSelected = iso === value;
                const isToday = iso === todayIso;
                return (
                  <Pressable
                    key={i}
                    style={styles.dayCell}
                    onPress={() => select(day)}
                    testID={`calendar-day-${day}`}
                  >
                    <View style={[styles.dayInner, isSelected && styles.daySelected, !isSelected && isToday && styles.dayToday]}>
                      <Text style={[styles.dayText, isSelected && styles.daySelectedText, !isSelected && isToday && styles.dayTodayText]}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.todayBtn}
              onPress={() => { const t = new Date(); setCursor(t); onChange(toIso(t)); setOpen(false); }}
              testID="calendar-today"
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </Pressable>
          </Pressable>
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
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  monthTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurface },
  weekRow: { flexDirection: "row", marginBottom: spacing.xs },
  weekday: { flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.muted },
  daysGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayInner: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: colors.brand },
  dayToday: { borderWidth: 1.5, borderColor: colors.brand },
  dayText: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurface },
  daySelectedText: { color: "#FFFFFF", fontFamily: fonts.bold },
  dayTodayText: { color: colors.brand, fontFamily: fonts.bold },
  todayBtn: { marginTop: spacing.md, alignSelf: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  todayBtnText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.brand },
});
