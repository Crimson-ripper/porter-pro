import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

export const colors = {
  primary: '#1D4ED8',
  primaryDark: '#1E3A8A',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  green: '#16A34A',
  red: '#DC2626',
  pickup: '#16A34A',
  drop: '#DC2626',
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.red : 'transparent';
  const fg = variant === 'outline' ? colors.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.primary },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Dot({ color }: { color: string }) {
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 10 }} />;
}

export const styles = StyleSheet.create({
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '600' },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  error: { color: colors.red, marginTop: 8, fontSize: 14 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
});
