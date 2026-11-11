import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, CheckCircle2, ChevronRight, LogOut, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field } from '@/src/components/ui';
import { createTicket, getRates, getTicket, updateTicketBasics } from '@/src/database/repository';
import { readPlateFromImage } from '@/src/services/plateRecognition';
import { common, colors, radius, spacing } from '@/src/theme';
import { formatPKR, vehicleEmojis, vehicleLabels } from '@/src/utils/format';
import { PaymentMethod, VehicleType } from '@/src/types';

export default function Entry() {
  const router = useRouter(); const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ editId?: string }>();
  const existing = useMemo(() => params.editId ? getTicket(params.editId) : null, [params.editId]);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const rates = useMemo(() => getRates(), []); const available = rates.filter(r => Number(r.enabled) === 1);
  const [type, setType] = useState<VehicleType>((existing?.vehicleType ?? available[0]?.vehicle_type ?? 'bike') as VehicleType);
  const [plate, setPlate] = useState(existing?.plate ?? ''); const [payAtEntry, setPayAtEntry] = useState(existing?.paymentStatus === 'paid');
  const [method, setMethod] = useState<PaymentMethod>(existing?.paymentMethod ?? 'cash'); const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false); const [scanning, setScanning] = useState(false); const [scanMessage, setScanMessage] = useState('Center the plate inside the frame.');
  const rate = rates.find(r => r.vehicle_type === type) ?? available[0];

  const openCamera = async () => { if (!permission?.granted) { const result = await requestPermission(); if (!result.granted) { Alert.alert('Camera permission needed', 'Allow camera access to scan the number plate.'); return; } } setCameraReady(false); setScanMessage('Center the plate inside the frame.'); setCameraOpen(true); };
  const capturePlate = async () => {
    if (!cameraRef.current || !cameraReady || scanning) return;
    setScanning(true); setScanMessage('Reading plate...');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) throw new Error('Camera did not return an image.');
      const detected = await readPlateFromImage(photo.uri);
      if (!detected) { setScanMessage('Plate not clear. Move closer, improve light, and try again.'); return; }
      setPlate(detected); setCameraOpen(false);
    } catch (error: any) {
      const message = String(error?.message ?? '');
      setScanMessage(message.includes('doesn\'t seem to be linked') ? 'Automatic OCR needs the ParkEase development build. Enter the plate below.' : 'Could not read this plate. Try again or enter it below.');
    } finally { setScanning(false); }
  };
  const save = () => { try { if (!rate) throw new Error('Enable at least one vehicle type in Settings.'); if (params.editId) { updateTicketBasics(params.editId, { plate, vehicleType: type }); router.replace(`/receipt/${params.editId}`); return; } const result = createTicket({ plate, vehicleType: rate.vehicle_type as VehicleType, payAtEntry, paymentMethod: method }); if (result.watchlistMatches.length) Alert.alert('WATCHLIST MATCH', `Verify ${plate.toUpperCase()} before allowing normal operations.`); router.replace(`/receipt/${result.ticket.id}`); } catch (e: any) { Alert.alert(existing ? 'Cannot update receipt' : 'Cannot save entry', e.message); } };

  if (cameraOpen) return <View style={{ flex: 1, backgroundColor: '#000' }}><StatusBar style="light" /><CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" onCameraReady={() => setCameraReady(true)} /><View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16 }}><View style={common.between}><Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Scan Number Plate</Text><Pressable onPress={() => setCameraOpen(false)} hitSlop={12}><X size={28} color="#fff" /></Pressable></View><View style={{ height: 132, borderWidth: 2, borderColor: colors.primary, borderRadius: 14, marginHorizontal: 5 }} /><View style={{ backgroundColor: 'rgba(0,0,0,.72)', borderRadius: 14, padding: 14, gap: 10 }}><Text style={{ color: '#fff', textAlign: 'center', lineHeight: 19 }}>{scanMessage}</Text><Button title={scanning ? 'Reading...' : 'Capture & Read Plate'} onPress={capturePlate} loading={scanning} disabled={!cameraReady} /></View></View></View>;

  return <View style={common.screen}><View style={[common.between, { paddingHorizontal: spacing.lg, paddingTop: insets.top + 10, paddingBottom: 12 }]}><View style={[common.row, { gap: 7 }]}><Pressable onPress={() => router.back()} hitSlop={10}><Text style={{ fontSize: 24, color: colors.text }}>‹</Text></Pressable><View><Text style={common.label}>PARKING OPERATIONS</Text><Text style={[common.h2, { marginTop: 3 }]}>{existing ? 'Edit Receipt' : 'New Entry'}</Text></View></View><View style={[common.row, { gap: 8 }]}><Pressable onPress={() => router.push('/exit' as any)} style={[common.outlineButton, { minHeight: 34, paddingVertical: 7, paddingHorizontal: 9, flexDirection: 'row', gap: 4, borderColor: colors.primary }]}><LogOut size={14} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>Exit</Text></Pressable><Pressable onPress={() => router.back()} hitSlop={10}><X size={22} color={colors.secondary} /></Pressable></View></View><ScrollView contentContainerStyle={[common.content, { paddingBottom: insets.bottom + 36 }]}>
    <Text style={common.label}>1. SELECT VEHICLE TYPE</Text><View style={[common.row, { gap: 8, marginTop: 9, flexWrap: 'wrap' }]}>{available.map(v => <Pressable key={v.vehicle_type} onPress={() => setType(v.vehicle_type as VehicleType)} style={{ width: '18%', minWidth: 58, minHeight: 83, alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 1.5, borderColor: type === v.vehicle_type ? colors.primary : colors.border, borderRadius: radius.md, backgroundColor: type === v.vehicle_type ? colors.greenSoft : colors.surface }}><Text style={{ fontSize: 27 }}>{vehicleEmojis[v.vehicle_type as VehicleType]}</Text><Text style={{ fontSize: 10, fontWeight: '900', color: type === v.vehicle_type ? colors.primary : colors.text }}>{vehicleLabels[v.vehicle_type as VehicleType]}</Text><Text style={{ fontSize: 10, fontWeight: '900', color: colors.primary }}>{formatPKR(v.base_rate)}</Text></Pressable>)}{available.length === 0 && <View style={[common.card, { width: '100%', backgroundColor: colors.amberSoft, borderColor: '#FDE68A' }]}><Text style={{ fontWeight: '800', color: '#8A5A00' }}>No vehicle types enabled</Text></View>}</View>
    <View style={{ marginTop: spacing.lg }}><Text style={common.label}>2. NUMBER PLATE</Text><View style={[common.card, { marginTop: 9, padding: 12, gap: 10 }]}><Field label="Registration number" value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder="LEA 1234" /><Pressable onPress={openCamera} style={[common.primaryButton, { flexDirection: 'row', gap: 8 }]}><Camera size={17} color="#fff" /><Text style={common.primaryButtonText}>Open Camera & Scan</Text></Pressable></View></View>
    <View style={{ marginTop: spacing.lg }}><Text style={common.label}>3. PARKING FEE</Text><View style={[common.card, common.between, { marginTop: 9, paddingVertical: 13 }]}><View style={[common.row, { gap: 10 }]}><View style={{ width: 31, height: 31, borderRadius: 9, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '900' }}>PKR</Text></View><Text style={common.body}>Parking Fee</Text></View><View style={[common.row, { gap: 5 }]}><Text style={{ fontSize: 16, fontWeight: '900', color: colors.primary }}>{formatPKR(rate?.base_rate ?? 0)}</Text><ChevronRight size={17} color={colors.secondary} /></View></View></View>
    {!existing && <View style={{ marginTop: spacing.lg }}><Text style={common.label}>4. PAYMENT OPTION</Text><View style={[common.row, { gap: 8, marginTop: 9 }]}>{[['Pay at Entry', true], ['Pay at Exit', false]].map(([label, value]: any) => <Pressable key={label} onPress={() => setPayAtEntry(value)} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: payAtEntry === value ? colors.primary : colors.border, borderRadius: radius.md, backgroundColor: payAtEntry === value ? colors.greenSoft : colors.surface }}><View style={[common.row, { gap: 7 }]}><CheckCircle2 size={16} color={payAtEntry === value ? colors.primary : colors.border} /><Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>{label}</Text></View></Pressable>)}</View>{payAtEntry && <View style={[common.row, { gap: 8, marginTop: 8 }]}>{(['cash', 'digital', 'card'] as PaymentMethod[]).map(m => <Pressable key={m} onPress={() => setMethod(m)} style={[common.outlineButton, { flex: 1, minHeight: 37, paddingVertical: 8, borderColor: method === m ? colors.primary : colors.border, backgroundColor: method === m ? colors.greenSoft : colors.surface }]}><Text style={{ fontSize: 11, fontWeight: '800' }}>{m[0].toUpperCase() + m.slice(1)}</Text></Pressable>)}</View>}</View>}
    <View style={{ marginTop: spacing.xl }}><Button title={existing ? 'Save Changes' : 'Save & Print Receipt'} onPress={save} /></View>
  </ScrollView></View>;
}
