import { useRouter } from 'expo-router';
import { CheckCircle2, Clipboard, Gift, KeyRound, RefreshCw, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field } from '@/src/components/ui';
import { getActiveLicense, getAppMetadata } from '@/src/database/repository';
import { getDeviceId, verifyLicense } from '@/src/services/licensing';
import { colors, common, spacing } from '@/src/theme';
import { formatDate } from '@/src/utils/format';

export default function License() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [device, setDevice] = useState('');
  const [license, setLicense] = useState('');
  const [acknowledgement, setAcknowledgement] = useState(getAppMetadata('last_activation_ack') ?? '');
  const [active, setActive] = useState<any>(getActiveLicense());
  useEffect(() => { getDeviceId().then(setDevice); }, []);
  const activate = async () => { try { const result = await verifyLicense(license.trim(), device); setActive(result); setLicense(''); Alert.alert('License activated', `Valid until ${formatDate(result.expiresAt)}.`); } catch (error: any) { Alert.alert('Activation failed', error.message); } };
  const requestRenewal = () => Share.share({ message: `ParkEase renewal request\nInstallation ID: ${device}\nCurrent license expiry: ${active?.expires_at ?? active?.expiresAt ?? 'Not activated'}\nPlease send a new signed activation license.`, title: 'Request ParkEase renewal' });
  const copy = async (value: string, label: string) => { if (value) { await setStringAsync(value); Alert.alert('Copied', `${label} copied.`); } };
  const shareAck = () => acknowledgement && Share.share({ message: `ParkEase activation acknowledgement:\n${acknowledgement}`, title: 'ParkEase activation acknowledgement' });
  return <ScrollView style={common.screen} contentContainerStyle={[common.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 36 }]}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '800' }}>‹ More</Text></Pressable><View style={[common.between, { marginTop: spacing.lg }]}><View><Text style={common.label}>SUBSCRIPTION</Text><Text style={[common.title, { marginTop: 4 }]}>License</Text></View><KeyRound size={25} color={colors.primary} /></View>
    <View style={[common.card, { marginTop: spacing.lg, backgroundColor: active ? colors.greenSoft : colors.amberSoft, borderColor: active ? '#BFE8D2' : '#FDE68A' }]}><View style={[common.row, { gap: 9 }]}><CheckCircle2 size={25} color={active ? colors.primary : colors.warning} /><View><Text style={{ fontWeight: '900', color: colors.text }}>{active ? 'Access active' : 'Access not activated'}</Text><Text style={common.muted}>{active ? 'Offline access is enabled' : 'Paste a signed license below'}</Text></View></View>{active && <View style={[common.between, { marginTop: 17 }]}><View><Text style={common.muted}>Valid until</Text><Text style={{ fontWeight: '900', color: colors.text, marginTop: 3 }}>{formatDate(active.expires_at ?? active.expiresAt)}</Text></View><Text style={{ fontSize: 12, fontWeight: '900', color: colors.primary }}>{active.planId ?? 'Signed plan'}</Text></View>}</View>
    <Text style={[common.label, { marginTop: spacing.xl }]}>YOUR DEVICE ID</Text><Pressable onPress={() => copy(device, 'Device ID')} style={[common.card, common.between, { marginTop: 8 }]}><Text selectable style={{ fontSize: 12, fontWeight: '800', color: colors.text, flex: 1 }}>{device || 'Generating...'}</Text><Clipboard size={17} color={colors.primary} /></Pressable><Text style={[common.label, { marginTop: spacing.lg }]}>ACTIVATE LICENSE</Text><View style={[common.card, { marginTop: 8, gap: 12 }]}><Field label="Signed activation license" value={license} onChangeText={setLicense} autoCapitalize="none" multiline placeholder="Paste the license from ParkEase owner" /><Button title="Verify & activate" onPress={activate} /></View>
    <Button title="Request renewal from owner" variant="outline" onPress={requestRenewal} />
    {acknowledgement && <View style={[common.card, { marginTop: spacing.lg, backgroundColor: colors.blueSoft, gap: 9 }]}><Text style={common.label}>OFFLINE ACTIVATION ACKNOWLEDGEMENT</Text><Text selectable style={{ color: colors.text, fontSize: 11, lineHeight: 17 }}>{acknowledgement}</Text><View style={[common.row, { gap: 8 }]}><Pressable onPress={() => copy(acknowledgement, 'Acknowledgement')} style={[common.outlineButton, { flex: 1, flexDirection: 'row', gap: 5 }]}><Clipboard size={14} color={colors.primary} /><Text style={common.outlineButtonText}>Copy</Text></Pressable><Pressable onPress={shareAck} style={[common.primaryButton, { flex: 1, flexDirection: 'row', gap: 5 }]}><Share2 size={14} color="#fff" /><Text style={common.primaryButtonText}>Share</Text></Pressable></View></View>}
    <View style={[common.card, { marginTop: spacing.lg, backgroundColor: colors.amberSoft, borderColor: '#FDE68A' }]}><View style={[common.row, { gap: 8 }]}><Gift size={18} color={colors.warning} /><Text style={{ fontWeight: '900', color: '#8A5A00' }}>Referral & rewards</Text></View><Text style={[common.muted, { marginTop: 6, lineHeight: 18 }]}>Referral codes and verified rewards are managed by the software owner.</Text><Pressable onPress={() => router.push('/settings/referrals')} style={{ marginTop: 8 }}><View style={[common.row, { gap: 5 }]}><RefreshCw size={14} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '800' }}>Open referral dashboard</Text></View></Pressable></View>
  </ScrollView>;
}
