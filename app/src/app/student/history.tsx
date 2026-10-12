import { FlatList, RefreshControl, View } from 'react-native';
import { useHistory } from '@/api/hooks';
import { Avatar } from '@/components/Avatar';
import { FadeIn } from '@/components/Motion';
import { AppBar, PageHeader } from '@/components/PageHeader';
import { ScreenState } from '@/components/ScreenState';
import { Txt } from '@/components/Txt';
import { EmptyState } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { useHideLauncher, useScrollHide } from '@/lib/ui';
import { useIsWide } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { colors, shadowStyle, space } from '@/theme';

/** Evaluations the student has sent. A virtualized list, so long histories stay smooth. */
export default function HistoryScreen() {
  const wide = useIsWide();
  const query = useHistory();
  const scrollHide = useScrollHide();
  useTitle(tr('History', 'Kasaysayan'));
  useHideLauncher(query.data?.data.length === 0);

  if (!query.data) return <ScreenState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} />;
  const items = query.data.data;

  return (
    <FlatList
      {...scrollHide}
      data={items}
      keyExtractor={(e) => String(e.id)}
      initialNumToRender={12}
      windowSize={7}
      contentContainerStyle={{ paddingHorizontal: wide ? 52 : space.lg, paddingTop: wide ? 40 : 22, paddingBottom: 32, gap: 14, width: '100%', maxWidth: 960, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />}
      ListHeaderComponent={wide ? <PageHeader title={tr('History', 'Kasaysayan')} /> : <AppBar title={tr('History', 'Kasaysayan')} subtitle={tr('Your submitted evaluations', 'Mga naipasa mong evaluation')} />}
      ListEmptyComponent={<EmptyState mood="shy" title={tr('Nothing here yet', 'Wala pa rito')} message={tr('Your finished evaluations will show up here, so you can see what you’ve sent.', 'Lalabas dito ang mga natapos mong evaluation, para makita mo ang mga naipasa mo.')} />}
      renderItem={({ item: e, index }) => (
        <FadeIn delay={Math.min(index, 8) * 50}>
          <View style={[{ backgroundColor: colors.card, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, shadowStyle('soft')]}>
            <Avatar name={e.teacher.name} initials={e.teacher.initials} size={50} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt weight="semibold" size={17}>{e.teacher.name}</Txt>
              <Txt size={14} color={colors.muted}>{[e.subject?.code, e.subject?.name, e.period].filter(Boolean).join(' · ')}</Txt>
              {e.submitted_at && <Txt size={13} color={colors.muted}>{tr(`Submitted ${shortDate(e.submitted_at)}`, `Naipasa ${shortDate(e.submitted_at)}`)}</Txt>}
            </View>
            {e.overall_rating !== null && (
              <View style={{ alignItems: 'flex-end' }}>
                <Txt weight="semibold" size={22}>{e.overall_rating.toFixed(1)}</Txt>
                <Txt size={12} color={colors.muted}>{tr('your rating', 'rating mo')}</Txt>
              </View>
            )}
          </View>
        </FadeIn>
      )}
    />
  );
}
