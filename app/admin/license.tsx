import { useFocusEffect, useRouter } from 'expo-router';
import { CheckCircle2, Copy, KeyRound, Share2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { EmptyState, SectionTitle } from '@/src/components/ui';
import { adminApi, AdminCustomer } from '@/src/services/adminApi';
import { colors, common, spacing } from '@/src/theme';
import { formatDate } from '@/src/utils/format';

export default function LicenseGenerator() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminCustomer[]>([]);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [license, setLicense] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { adminApi.customers('', 'ACTIVE').then(setRows).catch(error => Alert.alert('Customers unavailable', error.message)); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const issue = async () => {
    const subscription = selected?.subscriptions?.[0];
    const device = selected?.devices?.find(item => item.active) ?? selected?.devices?.[0];
    if (!selected || !subscription || !device) { Alert.alert('Missing information', 'Select a customer with an active subscription and registered device.'); return; }
    setBusy(true);
    try { setLicense(await adminApi.issueLicense(subscription.id, device.id)); Alert.alert('License generated', 'The signed license is ready to copy or share.'); }
    catch (error: any) { Alert.alert('License failed', error.message); }
    finally { setBusy(false); }
  };
  const copy = async () => { if (license?.activationCode) { await setStringAsync(license.activationCode); Alert.alert('Copied', 'Activation license copied.'); } };
  const share = () => license?.activationCode && Share.share({ message: license.activationCode, title: 'ParkEase activation license' });
  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '800' }}>‹ Admin dashboard</Text></Pressable>
    <View style={[common.row, { gap: 9, marginTop: spacing.lg }]}><KeyRound size={25} color={colors.primary} /><View><Text style={common.title}>Generate license</Text><Text style={[common.muted, { marginTop: 3 }]}>Device-bound signed activation</Text></View></View>
    <SectionTitle title="Choose customer" />
    {rows.length === 0 ? <EmptyState title="No active customers" body="Register a customer and device before issuing a license." /> : rows.map(customer => { const active = selected?.id === customer.id; const subscription = customer.subscriptions?.[0]; const device = customer.devices?.find(item => item.active) ?? customer.devices?.[0]; return <Pressable key={customer.id} onPress={() => { setSelected(customer); setLicense(null); }} style={[common.card, { marginBottom: 8, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.greenSoft : colors.surface }]}><View style={common.between}><View style={{ flex: 1 }}><Text style={{ fontWeight: '900', color: colors.text }}>{customer.businessName}</Text><Text style={[common.muted, { marginTop: 3 }]}>{customer.fullName} · {subscription?.plan?.name ?? 'No plan'}</Text></View><CheckCircle2 size={19} color={active ? colors.primary : colors.border} /></View><Text style={[common.muted, { marginTop: 8 }]}>{device?.deviceIdentifier ?? 'No device'}{subscription?.expiresAt ? ` · expires ${formatDate(subscription.expiresAt)}` : ''}</Text></Pressable>; })}
    <View style={{ marginTop: spacing.sm }}><Pressable onPress={issue} disabled={busy} style={[common.primaryButton, { opacity: busy ? 0.5 : 1 }]}><Text style={common.primaryButtonText}>{busy ? 'Generating...' : 'Generate activation license'}</Text></Pressable></View>
    {license && <View style={[common.card, { marginTop: spacing.lg, backgroundColor: colors.greenSoft, borderColor: '#BFE8D2', gap: 10 }]}><Text style={common.label}>SIGNED LICENSE</Text><View style={{ alignItems: 'center', paddingVertical: 5 }}><QRCode value={license.activationCode} size={170} /></View><Text selectable style={{ color: colors.text, fontSize: 11, lineHeight: 17 }}>{license.activationCode}</Text><View style={[common.row, { gap: 8 }]}><Pressable onPress={copy} style={[common.outlineButton, { flex: 1, flexDirection: 'row', gap: 5 }]}><Copy size={15} color={colors.primary} /><Text style={common.outlineButtonText}>Copy</Text></Pressable><Pressable onPress={share} style={[common.primaryButton, { flex: 1, flexDirection: 'row', gap: 5 }]}><Share2 size={15} color="#fff" /><Text style={common.primaryButtonText}>Share</Text></Pressable></View></View>}
  </ScrollView>;
}
