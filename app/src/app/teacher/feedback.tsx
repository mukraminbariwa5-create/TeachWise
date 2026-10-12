import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useTeacherDashboard, useTeacherFeedback } from '@/api/hooks';
import { FadeIn } from '@/components/Motion';
import { AppBar, PageHeader } from '@/components/PageHeader';
import { ScreenState } from '@/components/ScreenState';
import { Txt } from '@/components/Txt';
import { Chip, CommentCard, EmptyState } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { useScrollHide } from '@/lib/ui';
import { useIsWide } from '@/lib/useLayout';
import { useTitle } from '@/lib/useTitle';
import { colors, space, text } from '@/theme';

/** Every anonymous comment from students, newest first, filterable by class. Loads more as you scroll. */
export default function FeedbackScreen() {
  const wide = useIsWide();
  const [offering, setOffering] = useState<number | null>(null);
  const dash = useTeacherDashboard();
  const query = useTeacherFeedback(offering);
  const scrollHide = useScrollHide();
  useTitle(tr('Feedback', 'Feedback'));

  const items = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  const classes = dash.data?.subjects ?? [];

  const header = (
    <View style={{ gap: space.md, marginBottom: space.xs }}>
      {wide ? <PageHeader title={tr('Feedback', 'Feedback')} /> : <AppBar title={tr('Feedback', 'Feedback')} subtitle={tr('Anonymous student comments', 'Anonymous na komento ng estudyante')} />}
      {classes.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          <Chip label={tr('All classes', 'Lahat ng klase')} on={offering === null} onPress={() => setOffering(null)} />
          {classes.map((c) => (
            <Chip key={c.id} label={`${c.subject.code ?? c.subject.name} · ${c.section}`} on={offering === c.id} onPress={() => setOffering(c.id)} />
          ))}
        </ScrollView>
      )}
      {query.data && total > 0 && <Txt size={text.small} color={colors.muted}>{tr(`${total} comment${total === 1 ? '' : 's'}`, `${total} komento`)}</Txt>}
    </View>
  );

  if (!query.data && !query.isLoading) return <ScreenState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <FlatList
      {...scrollHide}
      data={items}
      keyExtractor={(c, i) => String(c.id ?? i)}
      initialNumToRender={10}
      onEndReachedThreshold={0.4}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      contentContainerStyle={{ paddingHorizontal: wide ? 52 : space.lg, paddingTop: wide ? 40 : 22, paddingBottom: 40, gap: space.sm, width: '100%', maxWidth: 900, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        query.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxl }} />
        ) : (
          (query.data?.pages[0] as { locked?: boolean; min_responses?: number } | undefined)?.locked ? (
            <EmptyState mood="shy" title={tr('Comments appear soon', 'Lalabas ang komento sa lalong madaling panahon')} message={tr(`To keep students anonymous, comments show once at least ${(query.data?.pages[0] as { min_responses?: number }).min_responses ?? 3} students have evaluated you.`, `Para manatiling anonymous, lalabas ang komento kapag hindi bababa sa ${(query.data?.pages[0] as { min_responses?: number }).min_responses ?? 3} estudyante ang nag-evaluate.`)} />
          ) : (
          <EmptyState mood="shy" title={tr('No comments yet', 'Wala pang komento')} message={tr('When students leave a written comment, it shows up here without their name.', 'Kapag nag-iwan ng komento ang estudyante, lalabas ito rito nang walang pangalan.')} />
          )
        )
      }
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ marginVertical: space.lg }} /> : null}
      renderItem={({ item: c, index }) => (
        <FadeIn delay={Math.min(index, 8) * 40}>
          <CommentCard elevated comment={c.comment} rating={c.rating} meta={[c.subject_code, c.period, c.submitted_at && shortDate(c.submitted_at)].filter(Boolean).join(' · ')} />
        </FadeIn>
      )}
    />
  );
}

