import { Platform, StyleSheet } from 'react-native';

export const colors = {
  primary: '#0BAA68', primaryDark: '#07834F', background: '#F7FBF8', surface: '#FFFFFF', text: '#14231C',
  secondary: '#6C7D74', border: '#DDEAE2', success: '#0BAA68', warning: '#F59E0B',
  danger: '#E05252', blueSoft: '#E9F8F0', greenSoft: '#E9F8F0', amberSoft: '#FFF8E7',
  redSoft: '#FFF0F0', slateSoft: '#F1F6F3'
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 10, lg: 14 };
export const shadow = Platform.select({ ios: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: {width: 0, height: 2} }, android: { elevation: 2 } });

export const common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 20, paddingBottom: 120 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 23, fontWeight: '900', letterSpacing: -0.3 },
  h2: { color: colors.text, fontSize: 16, fontWeight: '900' },
  body: { color: colors.text, fontSize: 14 },
  muted: { color: colors.secondary, fontSize: 12 },
  label: { color: colors.secondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11, color: colors.text, fontSize: 15 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, minHeight: 48, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  outlineButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 44, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  outlineButtonText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.border }
});
