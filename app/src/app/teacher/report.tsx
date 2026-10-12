import { useState } from 'react';
import { Platform, ScrollView, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useTeacherReport } from '@/api/hooks';
import { Button } from '@/components/Button';
import { ReportView, reportSummary } from '@/components/ReportView';
import { ScreenState } from '@/components/ScreenState';
import { Chip, Screen } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { useScrollHide } from '@/lib/ui';
import { space } from '@/theme';

/** The teacher's full report, filterable by period. Print or save as PDF on a computer; share a summary from a phone. */
export default function TeacherReportScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<number | null>(null);
  const query = useTeacherReport(period);
  const scrollHide = useScrollHide();
  const r = query.data;
  const web = Platform.OS === 'web';

  const action = r ? (
    web ? (
      <Button title={tr('Print / Save PDF', 'I-print / I-save PDF')} variant="outline" onPress={() => window.open(`/print/report${period ? `?period=${period}` : ''}`, '_blank')} />
    ) : (
      <Button title={tr('Share', 'I-share')} variant="outline" onPress={() => Share.share({ message: reportSummary(r) })} />
    )
  ) : undefined;

  return (
    <Screen title={tr('My report', 'Report ko')} subtitle={tr('Everything students and colleagues said about your teaching', 'Lahat ng sinabi ng estudyante at kasamahan tungkol sa pagtuturo mo')} maxWidth={960} right={action} onBack={() => (router.canGoBack() ? router.back() : router.replace('/teacher'))} {...scrollHide}>
      {r && r.trend.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          <Chip label={tr('All periods', 'Lahat ng period')} on={period === null} onPress={() => setPeriod(null)} />
          {r.trend.map((t) => (
            <Chip key={t.period_id} label={t.period} on={period === t.period_id} onPress={() => setPeriod(t.period_id)} />
          ))}
        </ScrollView>
      )}
      {r ? <ReportView report={r} /> : <ScreenState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} />}
    </Screen>
  );
}

