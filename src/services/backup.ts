import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { exportLocalBackup, LocalBackup, restoreLocalBackup } from '@/src/database/repository';

type BackupEnvelope = {
  format: 'parkease-backup-file';
  version: 1;
  checksum: string;
  backup: LocalBackup;
};

const digest = (value: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);

export async function createLocalBackupFile() {
  const backup = exportLocalBackup();
  const serializedBackup = JSON.stringify(backup);
  const envelope: BackupEnvelope = {
    format: 'parkease-backup-file',
    version: 1,
    checksum: await digest(serializedBackup),
    backup,
  };
  const filename = `parkease-backup-${backup.createdAt.replace(/[:.]/g, '-')}.json`;
  const uri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(envelope), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save ParkEase backup' });
  return { uri, filename, tableCount: Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0) };
}

export async function restoreLocalBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]?.uri) return { canceled: true as const };
  const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(raw) as BackupEnvelope;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  if (envelope?.format !== 'parkease-backup-file' || envelope.version !== 1 || !envelope.backup || typeof envelope.checksum !== 'string') {
    throw new Error('This is not a supported ParkEase backup file.');
  }
  const expected = await digest(JSON.stringify(envelope.backup));
  if (expected !== envelope.checksum) throw new Error('Backup integrity check failed. The file may be incomplete or modified.');
  restoreLocalBackup(envelope.backup);
  return { canceled: false as const, filename: result.assets[0].name ?? 'ParkEase backup' };
}
