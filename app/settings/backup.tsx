import { useRouter } from 'expo-router';
import { DatabaseBackup } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '@/src/components/ui';
import { createLocalBackupFile, restoreLocalBackupFile } from '@/src/services/backup';
import { colors, common, spacing } from '@/src/theme';

export default function Backup() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const result = await createLocalBackupFile();
      Alert.alert('Backup ready', `${result.filename}\n${result.tableCount} local records included.`);
    } catch (error: any) {
      Alert.alert('Backup failed', error?.message ?? 'Could not create the backup file.');
    } finally { setBusy(false); }
  };

  const restore = () => Alert.alert('Restore backup?', 'This replaces local parking records and settings with the selected backup.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Choose file', onPress: async () => {
      setBusy(true);
      try {
        const result = await restoreLocalBackupFile();
        if (!result.canceled) Alert.alert('Restore complete', `${result.filename} was restored. Reopen the app to refresh all screens.`);
      } catch (error: any) {
        Alert.alert('Restore failed', error?.message ?? 'Could not restore this backup.');
      } finally { setBusy(false); }
    } },
  ]);

  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '700' }}>‹  Settings</Text></Pressable>
    <Text style={[common.title, { marginTop: spacing.lg }]}>Backup & restore</Text>
    <Text style={[common.muted, { marginTop: 5, lineHeight: 19 }]}>Export an integrity-checked copy of local records. No cloud account is required.</Text>
    <View style={[common.card, { marginTop: spacing.xl, alignItems: 'center', gap: 9, paddingVertical: 28 }]}>
      <DatabaseBackup size={36} color={colors.success} />
      <Text style={common.h2}>Local database backup</Text>
      <Text style={[common.muted, { textAlign: 'center' }]}>Includes tickets, payments, rates, settings, licenses and watchlist data.</Text>
      <Button title={busy ? 'Working...' : 'Create backup'} loading={busy} disabled={busy} onPress={create} />
      <Button title="Restore backup" variant="outline" loading={busy} disabled={busy} onPress={restore} />
    </View>
  </ScrollView>;
}
