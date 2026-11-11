import { useRouter } from 'expo-router';
import { CheckCircle2, Clipboard, KeyRound, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field } from '@/src/components/ui';
import { adminApi } from '@/src/services/adminApi';
import { setAppMetadata } from '@/src/database/repository';
import { getLicenseStatus } from '@/src/database/repository';
import { createActivationAcknowledgement, getDeviceId, validateStoredLicense, verifyLicense } from '@/src/services/licensing';
import { colors, common, spacing } from '@/src/theme';

export default function Activation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [device, setDevice] = useState('');
  const [license, setLicense] = useState('');
  const [acknowledgement, setAcknowledgement] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'EXPIRED' | 'CLOCK_SUSPECTED' | 'NOT_ACTIVATED'>(getLicenseStatus());
  const [busy, setBusy] = useState(false);
  useEffect(() => { getDeviceId().then(setDevice); validateStoredLicense().then(setStatus); }, []);
  const activate = async () => {
    setBusy(true);
    try {
      const payload = await verifyLicense(license, device);
      const ack = await createActivationAcknowledgement(license.trim(), payload, device);
      setAcknowledgement(ack);
      setAppMetadata('last_activation_ack', ack);
      setStatus('ACTIVE');
      adminApi.acknowledgeActivation(payload.licenseId, device, ack).catch(() => undefined);
      Alert.alert('ParkEase activated', 'Your offline parking tools are ready. You can share the acknowledgement with the owner later.', [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }]);
    } catch (error: any) { Alert.alert('Activation failed', error.message); }
    finally { setBusy(false); }
  };
  const copy = async (value: string, label: string) => { if (value) { await setStringAsync(value); Alert.alert('Copied', `${label} copied.`); } };
  const shareDevice = async () => { if (device) await Share.share({ message: `ParkEase installation ID: ${device}`, title: 'ParkEase installation ID' }); };
  const shareAck = async () => { if (acknowledgement) await Share.share({ message: `ParkEase activation acknowledgement:\n${acknowledgement}`, title: 'ParkEase activation acknowledgement' }); };
  const expired = status === 'EXPIRED';
  const clockSuspected = status === 'CLOCK_SUSPECTED';
  return <ScrollView style={common.screen} contentContainerStyle={[common.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 32 }]}>
    <View style={{ alignItems: 'center', marginTop: spacing.xl }}><View style={{ width: 66, height: 66, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><KeyRound size={32} color="#fff" /></View><Text style={[common.title, { marginTop: 16 }]}>Welcome to ParkEase</Text><Text style={[common.muted, { marginTop: 5 }]}>Smart Parking Management Solution</Text></View>
    <View style={[common.card, { marginTop: spacing.xxl, backgroundColor: expired || clockSuspected ? colors.amberSoft : colors.greenSoft, borderColor: expired || clockSuspected ? '#FDE68A' : '#BFE8D2' }]}><View style={[common.row, { gap: 10 }]}><CheckCircle2 size={23} color={expired || clockSuspected ? colors.warning : colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '900', color: colors.text }}>{clockSuspected ? 'Check device date and time' : expired ? 'Subscription expired' : 'Activation required'}</Text><Text style={[common.muted, { marginTop: 4, lineHeight: 18 }]}>{clockSuspected ? 'ParkEase detected that the device clock moved backwards. Correct it before activation or parking.' : expired ? 'Enter a renewed signed license to continue new parking entries.' : 'Activate once, then continue using ParkEase offline.'}</Text></View></View></View>
    <Text style={[common.label, { marginTop: spacing.xl }]}>INSTALLATION ID</Text><Pressable onPress={() => copy(device, 'Installation ID')} style={[common.card, common.between, { marginTop: 8 }]}><Text selectable style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: 12 }}>{device || 'Generating...'}</Text><Clipboard size={17} color={colors.primary} /></Pressable>
    <View style={[common.row, { gap: 8, marginTop: 8 }]}><Pressable onPress={shareDevice} style={[common.outlineButton, { flex: 1, flexDirection: 'row', gap: 6 }]}><Share2 size={15} color={colors.primary} /><Text style={common.outlineButtonText}>Send ID to owner</Text></Pressable></View>
    <View style={[common.card, { marginTop: spacing.lg, gap: 12 }]}><Field label="Signed activation license" value={license} onChangeText={setLicense} autoCapitalize="none" multiline placeholder="Paste the license received from ParkEase owner" /><Button title={busy ? 'Checking...' : 'Activate software'} onPress={activate} loading={busy} disabled={busy || !device || !license.trim()} /></View>
    {expired && <View style={{ marginTop: spacing.sm }}><Button title="View saved parking records" variant="outline" onPress={() => router.replace('/(tabs)/history' as any)} /></View>}
    {acknowledgement && <View style={[common.card, { marginTop: spacing.lg, backgroundColor: colors.blueSoft, gap: 10 }]}><Text style={common.label}>ACTIVATION ACKNOWLEDGEMENT</Text><Text selectable style={{ color: colors.text, fontSize: 11, lineHeight: 17 }}>{acknowledgement}</Text><View style={[common.row, { gap: 8 }]}><Pressable onPress={() => copy(acknowledgement, 'Acknowledgement')} style={[common.outlineButton, { flex: 1 }]}><Text style={common.outlineButtonText}>Copy</Text></Pressable><Pressable onPress={shareAck} style={[common.primaryButton, { flex: 1 }]}><Text style={common.primaryButtonText}>Share</Text></Pressable></View></View>}
    <Text style={[common.muted, { textAlign: 'center', lineHeight: 18, marginTop: spacing.lg }]}>Need help? Share your Installation ID with the software owner. License verification works without internet.</Text>
  </ScrollView>;
}
