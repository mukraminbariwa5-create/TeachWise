import { useEffect } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAppInfo, useFacultyReport, useTeacherReport } from '@/api/hooks';
import { useAuth } from '@/auth/store';
import { Button } from '@/components/Button';
import { ReportView } from '@/components/ReportView';
import { ScreenState } from '@/components/ScreenState';
import { tr } from '@/lib/i18n';
import { useForceLight } from '@/lib/theme';
import { useTitle } from '@/lib/useTitle';
import { colors, space } from '@/theme';

/**
 * A clean, frame-free page for printing or "Save as PDF". Teachers get their own report;
 * admins pass ?teacher=ID. Opens the print dialog once the report has loaded.
 */
export default function PrintReport() {
  const params = useLocalSearchParams<{ teacher?: string; period?: string }>();
  const user = useAuth((s) => s.user);
  const period = params.period ? Number(params.period) : null;
  const admin = user?.role === 'admin';
  const own = useTeacherReport(period);
  const other = useFacultyReport(admin && params.teacher ? Number(params.teacher) : null, period);
  const query = admin ? other : own;
  const info = useAppInfo();
  const r = query.data;
  useTitle(r ? `${r.teacher.name} · ${tr('Report', 'Report')}` : tr('Report', 'Report'));

  useEffect(() => {
    useForceLight.setState({ on: true });
    return () => useForceLight.setState({ on: false });
  }, []);

  useEffect(() => {
    if (r && Platform.OS === 'web') {
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
  }, [r]);

  if (!user) return <Redirect href="/login" />;
  if (user.role === 'student') return <Redirect href="/student" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentContainerStyle={{ padding: space.xl, maxWidth: 900, width: '100%', alignSelf: 'center', gap: space.lg }}>
      {r ? (
        <>
          <ReportView report={r} printable schoolName={info.data?.school_name} />
          {Platform.OS === 'web' && (
            <View style={{ alignItems: 'center' }} {...({ dataSet: { noprint: '1' } } as object)}>
              <Button title={tr('Print again', 'I-print ulit')} variant="outline" onPress={() => window.print()} />
            </View>
          )}
        </>
      ) : (
        <View style={{ minHeight: 400, backgroundColor: colors.card }}>
          <ScreenState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} />
        </View>
      )}
    </ScrollView>
  );
}
