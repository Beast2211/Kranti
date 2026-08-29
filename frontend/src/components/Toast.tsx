import React, { createContext, useContext, useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadow } from "@/src/theme";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{ show: (m: string, t?: ToastType) => void }>({
  show: () => {},
});

const ICONS: Record<ToastType, any> = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};
const TINT: Record<ToastType, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.brand,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      setToast({ message, type });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 2800);
    },
    [anim]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              top: insets.top + spacing.sm,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.toast} testID="app-toast">
            <Ionicons name={ICONS[toast.type]} size={20} color={TINT[toast.type]} />
            <Text style={styles.text} numberOfLines={3}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 520,
    ...shadow.raised,
  },
  text: {
    flex: 1,
    color: colors.onSurface,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
});
