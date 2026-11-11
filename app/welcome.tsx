import { useRouter } from 'expo-router';
import { ArrowRight, CarFront, ParkingSquare } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { colors, common, spacing } from '@/src/theme';
import { setAppMetadata } from '@/src/database/repository';

export default function Welcome() {
  const router = useRouter();
  const start = () => { setAppMetadata('setup_complete', '1'); router.replace('/activation' as any); };
  return <View style={[common.screen, { padding: spacing.xl, paddingTop: 62 }]}>
    <View style={{ alignItems: 'center' }}><View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><ParkingSquare size={32} color="#fff" strokeWidth={2.5} /></View><Text style={{ fontSize: 31, fontWeight: '900', color: colors.text, marginTop: 9, letterSpacing: -1 }}>Park<Text style={{ color: colors.primary }}>Ease</Text></Text><Text style={{ color: colors.secondary, fontSize: 13, marginTop: 2 }}>Smart Parking Solution</Text></View>
    <View style={{ height: 210, marginTop: 18, borderRadius: 28, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }}><ParkingSquare size={118} color={colors.primary} strokeWidth={1.2} /></View>
    <View style={{ alignItems: 'center', marginTop: 22 }}><Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Simple. Fast. Reliable.</Text><Text style={[common.muted, { textAlign: 'center', lineHeight: 19, marginTop: 8, maxWidth: 280 }]}>Manage your parking space efficiently with smart local tools.</Text></View>
    <Pressable onPress={start} style={({ pressed }) => [common.primaryButton, { marginTop: 'auto', width: '100%', flexDirection: 'row', gap: 8, opacity: pressed ? 0.8 : 1 }]}><Text style={common.primaryButtonText}>Get Started</Text><ArrowRight size={18} color="#fff" /></Pressable>
    <View style={[common.row, { justifyContent: 'center', gap: 6, marginTop: 14 }]}><CarFront size={14} color={colors.primary} /><Text style={common.muted}>Works offline · PKR · Asia/Karachi</Text></View>
  </View>;
}
