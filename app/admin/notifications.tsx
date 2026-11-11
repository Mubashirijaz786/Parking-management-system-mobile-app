import { useRouter } from 'expo-router';
import { Bell, CircleAlert, History } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { EmptyState, SectionTitle } from '@/src/components/ui';
import { adminApi } from '@/src/services/adminApi';
import { colors, common, spacing } from '@/src/theme';
import { formatDateTime } from '@/src/utils/format';

export default function AdminNotifications() {
  const router = useRouter();
  const [data, setData] = useState<any>({ stored: [], expiring: [], overdue: [], activity: [] });
  useEffect(() => { adminApi.notifications().then(setData).catch(e => Alert.alert('Notifications unavailable', e.message)); }, []);
  const alerts = [...(data.expiring ?? []), ...(data.overdue ?? []), ...(data.stored ?? [])];
  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '800' }}>‹ Admin dashboard</Text></Pressable>
    <View style={[common.row, { gap: 9, marginTop: spacing.lg }]}><Bell size={25} color={colors.primary} /><View><Text style={common.title}>Notifications</Text><Text style={[common.muted, { marginTop: 3 }]}>Live expiry, payment alerts and activity</Text></View></View>
    <SectionTitle title={`${alerts.length} alerts`} />
    {alerts.length === 0 ? <EmptyState title="No alerts" body="There are no current expiry or unpaid-invoice alerts." /> : alerts.map((item: any, index: number) => <View key={`${item.type}-${item.customerId ?? index}`} style={[common.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: item.type === 'UNPAID_INVOICE' ? colors.danger : colors.warning }]}><View style={[common.row, { gap: 8 }]}><CircleAlert size={17} color={item.type === 'UNPAID_INVOICE' ? colors.danger : colors.warning} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '900', color: colors.text }}>{item.title}</Text><Text style={[common.muted, { marginTop: 4, lineHeight: 18 }]}>{item.body}</Text></View></View></View>)}
    <SectionTitle title="Recent activity" />
    {(data.activity ?? []).length === 0 ? <EmptyState title="No recent activity" body="Customer, payment and licensing actions will appear here." /> : (data.activity ?? []).map((item: any, index: number) => <View key={`${item.createdAt}-${index}`} style={[common.card, { marginBottom: 8 }]}><View style={[common.row, { gap: 8 }]}><History size={17} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '900', color: colors.text }}>{item.title}</Text><Text style={[common.muted, { marginTop: 4 }]}>{item.body}</Text><Text style={[common.muted, { marginTop: 4, fontSize: 11 }]}>{formatDateTime(item.createdAt)}</Text></View></View></View>)}
  </ScrollView>;
}
