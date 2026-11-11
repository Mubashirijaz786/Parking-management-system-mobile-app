import { useRouter } from 'expo-router';
import { LogOut, ShieldCheck } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, SectionTitle } from '@/src/components/ui';
import { adminApi } from '@/src/services/adminApi';
import { colors, common, spacing } from '@/src/theme';

export default function AdminSettings() {
  const router = useRouter();
  const logout = async () => { await adminApi.logout(); router.replace('/admin/login' as any); };
  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '800' }}>‹ Admin dashboard</Text></Pressable>
    <View style={[common.row, { gap: 9, marginTop: spacing.lg }]}><ShieldCheck size={25} color={colors.primary} /><View><Text style={common.title}>Admin settings</Text><Text style={[common.muted, { marginTop: 3 }]}>Owner access and system boundaries</Text></View></View>
    <SectionTitle title="Security" />
    <View style={[common.card, { gap: 10 }]}><View style={common.between}><Text style={common.muted}>Authorization</Text><Text style={{ color: colors.success, fontWeight: '800' }}>Backend JWT</Text></View><View style={common.between}><Text style={common.muted}>License signing</Text><Text style={{ color: colors.success, fontWeight: '800' }}>Ed25519 server-side</Text></View><Text style={[common.muted, { lineHeight: 18 }]}>The mobile app never receives the private signing key or PostgreSQL credentials. Parking records remain local to the operator device.</Text></View>
    <SectionTitle title="Session" />
    <Button title="Sign out of admin" variant="danger" onPress={() => Alert.alert('Sign out?', 'You will need the owner credentials to reopen the admin panel.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: logout }])} />
    <Pressable onPress={() => router.replace('/(tabs)' as any)} style={[common.outlineButton, { marginTop: 10 }]}><Text style={common.outlineButtonText}>Open parking mode</Text></Pressable>
  </ScrollView>;
}
