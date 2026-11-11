import { useRouter } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { EmptyState, SectionTitle } from '@/src/components/ui';
import { adminApi } from '@/src/services/adminApi';
import { colors, common, spacing } from '@/src/theme';
import { formatDate } from '@/src/utils/format';

export default function AdminSubscriptions() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { adminApi.subscriptions().then(setRows).catch(e => Alert.alert('Subscriptions unavailable', e.message)); }, []);
  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '800' }}>‹ Admin dashboard</Text></Pressable>
    <View style={[common.row, { gap: 9, marginTop: spacing.lg }]}><CalendarClock size={25} color={colors.primary} /><View><Text style={common.title}>Subscriptions</Text><Text style={[common.muted, { marginTop: 3 }]}>Active, expired and renewal history</Text></View></View>
    <SectionTitle title={`${rows.length} subscription periods`} />
    {rows.length === 0 ? <EmptyState title="No subscriptions" body="Customer plans will appear here after registration." /> : rows.map(row => { const days = Math.ceil((new Date(row.expiresAt).getTime() - Date.now()) / 86400000); return <View key={row.id} style={[common.card, { marginBottom: 8 }]}><View style={common.between}><View style={{ flex: 1 }}><Text style={{ fontWeight: '900', color: colors.text }}>{row.customer?.businessName ?? row.customerId}</Text><Text style={[common.muted, { marginTop: 3 }]}>{row.plan?.name ?? row.planId} · {row.status}</Text></View><Text style={{ color: days < 0 ? colors.danger : days <= 7 ? colors.warning : colors.primary, fontWeight: '900' }}>{days < 0 ? 'EXPIRED' : `${days}d`}</Text></View><Text style={[common.muted, { marginTop: 9 }]}>{formatDate(row.startsAt)} → {formatDate(row.expiresAt)}</Text></View>; })}
  </ScrollView>;
}
