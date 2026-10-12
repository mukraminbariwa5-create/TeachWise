import { useState } from 'react';
import { Platform, ScrollView, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ApiError } from '@/api/client';
import { downloadFacultyCsv, useAdminDashboard } from '@/api/admin';
import { useFacultyReport } from '@/api/hooks';
import { DataList, SearchBox, Toolbar } from '@/components/admin/DataList';
import { Button } from '@/components/Button';
import { formatRating } from '@/components/Charts';
import { ReportView, reportSummary } from '@/components/ReportView';
import { ScreenState } from '@/components/ScreenState';
import { Chip, Screen } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { saveFile, today } from '@/lib/saveFile';
import { toast, useScrollHide } from '@/lib/ui';
import { space } from '@/theme';

/** Faculty results: everyone at a glance (and as a spreadsheet), or one teacher's full report. */
export default function ReportsScreen() {
  const params = useLocalSearchParams<{ teacher?: string }>();
  const teacherId = params.teacher ? Number(params.teacher) : null;
  return teacherId ? <TeacherReport id={teacherId} /> : <FacultyList />;
}

function PeriodChips({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const dash = useAdminDashboard();
  const periods = (dash.data?.periods ?? []).filter((p) => p.type === 'student');
  if (periods.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
      <Chip label={tr('All periods', 'Lahat ng period')} on={value === null} onPress={() => onChange(null)} />
      {periods.map((p) => (
        <Chip key={p.id} label={p.name} on={value === p.id} onPress={() => onChange(p.id)} />
      ))}
    </ScrollView>
  );
}

function FacultyList() {
  const router = useRouter();
  const dash = useAdminDashboard();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollHide = useScrollHide();
  const rows = (dash.data?.faculty ?? []).filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()));

  const csv = async () => {
    setBusy(true);
    try {
      await saveFile(`teachwise-faculty-report-${today()}.csv`, await downloadFacultyCsv(null), 'text/csv');
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t download the report.', 'Hindi ma-download ang report.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={tr('Reports', 'Mga report')} subtitle={tr('Ratings for every teacher. Open one for the full report.', 'Rating ng bawat guro. Buksan ang isa para sa buong report.')} maxWidth={1000} right={<Button title={tr('Download CSV', 'I-download ang CSV')} variant="outline" loading={busy} onPress={csv} />} {...scrollHide}>
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder={tr('Search teacher', 'Hanapin ang guro')} />
      </Toolbar>
      {!dash.data && !dash.isLoading ? (
        <ScreenState error={dash.error} onRetry={() => dash.refetch()} />
      ) : (
        <DataList
          rows={rows}
          keyOf={(t) => t.id}
          loading={dash.isLoading}
          onPress={(t) => router.push(`/admin/reports?teacher=${t.id}` as Href)}
          empty={{ title: tr('No teachers yet', 'Wala pang guro') }}
          columns={[
            { label: tr('Teacher', 'Guro'), flex: 2, render: (t) => t.name },
            { label: tr('Department', 'Departamento'), flex: 1.5, render: (t) => t.department ?? '—' },
            { label: tr('Responses', 'Sagot'), align: 'right', render: (t) => String(t.responses), phone: true },
            { label: tr('Average', 'Average'), align: 'right', render: (t) => formatRating(t.average), phone: true },
          ]}
        />
      )}
    </Screen>
  );
}

function TeacherReport({ id }: { id: number }) {
  const router = useRouter();
  const [period, setPeriod] = useState<number | null>(null);
  const query = useFacultyReport(id, period);
  const scrollHide = useScrollHide();
  const r = query.data;

  const action = r ? (
    Platform.OS === 'web' ? (
      <Button title={tr('Print / Save PDF', 'I-print / I-save PDF')} variant="outline" onPress={() => window.open(`/print/report?teacher=${id}${period ? `&period=${period}` : ''}`, '_blank')} />
    ) : (
      <Button title={tr('Share', 'I-share')} variant="outline" onPress={() => Share.share({ message: reportSummary(r) })} />
    )
  ) : undefined;

  return (
    <Screen title={r?.teacher.name ?? tr('Report', 'Report')} subtitle={tr('Faculty evaluation report', 'Report ng faculty evaluation')} maxWidth={960} right={action} onBack={() => router.replace('/admin/reports')} {...scrollHide}>
      <PeriodChips value={period} onChange={setPeriod} />
      {r ? <ReportView report={r} /> : <View style={{ minHeight: 300 }}><ScreenState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} /></View>}
    </Screen>
  );
}
