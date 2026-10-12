import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '@/api/client';
import type { PublicSchool } from '@/api/types';
import { Button } from '@/components/Button';
import { PublicPage } from '@/components/PublicPage';
import { SchoolBadge } from '@/components/SchoolBadge';
import { ScreenState } from '@/components/ScreenState';
import { Txt } from '@/components/Txt';
import { tr } from '@/lib/i18n';
import { usePickedSchool } from '@/lib/school';
import { colors, space, text } from '@/theme';

/** A school's join link, e.g. teachwise.app/join/MSUSULU: picks the school, then create an account or sign in. */
export default function JoinSchool() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const pick = usePickedSchool((s) => s.pick);
  const [school, setSchool] = useState<PublicSchool | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api<{ school: PublicSchool }>(`/schools/${encodeURIComponent(String(code ?? ''))}`, { token: null })
      .then((r) => setSchool(r.school))
      .catch(setError);
  }, [code]);

  const go = (mode: 'signup' | 'signin') => {
    if (school) pick(school);
    router.replace(`/login?mode=${mode}`);
  };

  if (!school) {
    return (
      <PublicPage title={tr('Join your school', 'Sumali sa paaralan mo')} mood={error ? 'worried' : 'think'}>
        {error ? (
          <View style={{ gap: space.md }}>
            <Txt size={text.bodyLg} color={colors.textSoft} style={{ lineHeight: 24 }}>
              {error instanceof ApiError ? error.message : tr('Couldn’t open this link. Check your connection.', 'Hindi mabuksan ang link. I-check ang connection mo.')}
            </Txt>
            <Button title={tr('Find my school', 'Hanapin ang paaralan ko')} onPress={() => router.replace('/login?mode=signup')} />
          </View>
        ) : (
          <ScreenState loading />
        )}
      </PublicPage>
    );
  }

  return (
    <PublicPage title={tr(`Welcome to ${school.short_name ?? school.name}`, `Maligayang pagdating sa ${school.short_name ?? school.name}`)} subtitle={tr('Your school uses TeachWise for anonymous teacher evaluations.', 'Gumagamit ang paaralan mo ng TeachWise para sa anonymous na teacher evaluation.')} mood="hello">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <SchoolBadge school={school} size={64} />
        <View style={{ flex: 1 }}>
          <Txt weight="bold" size={text.title}>{school.name}</Txt>
          {school.location ? <Txt size={text.body} color={colors.muted}>{school.location}</Txt> : null}
        </View>
      </View>
      <Button title={tr('Create my student account', 'Gumawa ng student account')} size="lg" onPress={() => go('signup')} />
      <Button title={tr('I already have an account', 'May account na ako')} variant="outline" size="lg" onPress={() => go('signin')} />
      <Txt size={text.small} color={colors.muted} style={{ textAlign: 'center' }}>{tr('Teachers: use the invite code from your admin instead.', 'Mga guro: gamitin ang invite code mula sa admin.')}</Txt>
    </PublicPage>
  );
}
