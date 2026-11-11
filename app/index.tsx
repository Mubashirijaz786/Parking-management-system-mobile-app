import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { initializeDatabase } from '@/src/database/db';
import { getAppMetadata } from '@/src/database/repository';
import { validateStoredLicense } from '@/src/services/licensing';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<'ACTIVE' | 'EXPIRED' | 'CLOCK_SUSPECTED' | 'NOT_ACTIVATED'>('NOT_ACTIVATED');
  useEffect(() => {
    let mounted = true;
    (async () => { initializeDatabase(); setSetup(getAppMetadata('setup_complete') === '1'); const status = await validateStoredLicense(); if (mounted) { setLicenseStatus(status); setReady(true); } })();
    return () => { mounted = false; };
  }, []);
  if (!ready) return null;
  if (!setup) return <Redirect href="/welcome" />;
  return <Redirect href={(licenseStatus === 'ACTIVE' ? '/(tabs)' : '/activation') as any} />;
}
