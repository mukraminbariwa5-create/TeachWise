import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useAdminList, type AdminPeriod, type AdminQuestion, type Semester } from '@/api/admin';
import { useAuth } from '@/auth/store';
import { CrudSection } from '@/components/admin/CrudSection';
import { Chip, Pill, Screen, Segmented } from '@/components/ui';
import { dateTime, inputDateTime } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { useScrollHide } from '@/lib/ui';
import { space } from '@/theme';

type Tab = 'periods' | 'questions';

/** When evaluations run, and what they ask (in English and Filipino). */
export default function EvaluationSetupScreen() {
  const [tab, setTab] = useState<Tab>('periods');
  const scrollHide = useScrollHide();
  return (
    <Screen title={tr('Evaluation setup', 'Setup ng evaluation')} subtitle={tr('Evaluation periods and the questions on each form', 'Mga evaluation period at ang mga tanong sa bawat form')} maxWidth={1100} {...scrollHide}>
      <Segmented<Tab>
        label={tr('Show', 'Ipakita')}
        value={tab}
        onChange={setTab}
        options={[
          { key: 'periods', label: tr('Periods', 'Mga period'), icon: 'calendar' },
          { key: 'questions', label: tr('Questions', 'Mga tanong'), icon: 'list' },
        ]}
      />
      {tab === 'periods' ? <Periods /> : <Questions />}
    </Screen>
  );
}

const typeLabel = (t: 'student' | 'peer') => (t === 'student' ? tr('Students rate teachers', 'Nire-rate ng estudyante ang guro') : tr('Teachers rate peers', 'Nire-rate ng guro ang kasamahan'));

function periodStatus(p: AdminPeriod) {
  const now = Date.now();
  if (p.is_open) return <Pill label={tr('Open', 'Bukas')} tone="green" />;
  if (new Date(p.opens_at).getTime() > now) return <Pill label={tr('Upcoming', 'Paparating')} tone="orange" />;
  return <Pill label={tr('Closed', 'Sarado')} tone="grey" />;
}

function Periods() {
  const semesters = useAdminList<Semester>('semesters');
  const peerOn = useAuth((s) => s.school?.settings.peer_evaluation ?? true);
  return (
    <CrudSection<AdminPeriod>
      resource="periods"
      noun={tr('period', 'period')}
      note={tr('People are notified automatically when a period opens, and reminded a day before it closes.', 'Kusang naaabisuhan ang mga tao kapag nagbukas ang period, at pinapaalalahanan isang araw bago magsara.')}
      empty={{ title: tr('No evaluation periods yet', 'Wala pang evaluation period'), message: tr('Add a period like “Midterm” with the dates students can evaluate.', 'Magdagdag ng period gaya ng “Midterm” kasama ang mga petsang puwedeng mag-evaluate.'), mood: 'idea' }}
      columns={[
        { label: tr('Period', 'Period'), flex: 1.5, render: (p) => p.name },
        { label: tr('Type', 'Uri'), flex: 1.6, render: (p) => typeLabel(p.type), phone: true },
        { label: tr('Opens', 'Bubukas'), flex: 1.4, render: (p) => dateTime(p.opens_at), phone: true },
        { label: tr('Closes', 'Magsasara'), flex: 1.4, render: (p) => dateTime(p.closes_at), phone: true },
        { label: tr('Status', 'Status'), render: periodStatus, phone: true },
      ]}
      fields={[
        { key: 'name', label: tr('Name', 'Pangalan'), kind: 'text', icon: 'edit', required: true, placeholder: 'Midterm', max: 60 },
        { key: 'type', label: tr('Who evaluates', 'Sino ang mag-e-evaluate'), kind: 'select', required: true, options: [{ value: 'student', label: tr('Students', 'Mga estudyante') }, ...(peerOn ? [{ value: 'peer', label: tr('Teachers (peer)', 'Mga guro (peer)') }] : [])], hint: peerOn ? undefined : tr('Peer evaluation is off in School settings.', 'Naka-off ang peer evaluation sa School settings.') },
        { key: 'opens_at', label: tr('Opens', 'Bubukas'), kind: 'datetime', required: true },
        { key: 'closes_at', label: tr('Closes', 'Magsasara'), kind: 'datetime', required: true, hint: tr('Must be after the opening time', 'Dapat pagkatapos ng oras ng pagbukas') },
        { key: 'semester_id', label: tr('Semester', 'Semestre'), kind: 'select', icon: 'calendar', searchable: true, options: (semesters.data?.data ?? []).map((s) => ({ value: s.id, label: s.name })) },
      ]}
      toForm={(p) => ({ name: p.name, type: p.type, opens_at: inputDateTime(p.opens_at), closes_at: inputDateTime(p.closes_at), semester_id: p.semester_id })}
      blank={{ name: '', type: 'student', opens_at: '', closes_at: '', semester_id: (semesters.data?.data ?? []).find((s) => s.is_active)?.id ?? null }}
    />
  );
}

function Questions() {
  const [audience, setAudience] = useState<'student' | 'peer'>('student');
  return (
    <CrudSection<AdminQuestion>
      resource="questions"
      params={{ audience }}
      noun={tr('question', 'tanong')}
      note={tr('Questions can’t change while an evaluation using them is open, so everyone answers the same form. Filipino text is optional. People who chose Filipino see it when it’s filled in. Questions that already have answers are switched off instead of deleted.', 'Hindi mababago ang mga tanong habang bukas ang evaluation na gumagamit nito, para pare-pareho ang form. Opsyonal ang Filipino. Makikita ito ng mga pumili ng Filipino kapag may laman. Ang mga tanong na may sagot na ay io-off sa halip na burahin.')}
      search={(x, q) => `${x.category ?? ''} ${x.text} ${x.text_fil ?? ''}`.toLowerCase().includes(q)}
      filters={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          <Chip label={tr('Student form', 'Form ng estudyante')} on={audience === 'student'} onPress={() => setAudience('student')} />
          <Chip label={tr('Peer form', 'Peer form')} on={audience === 'peer'} onPress={() => setAudience('peer')} />
        </ScrollView>
      }
      empty={{ title: tr('No questions on this form', 'Walang tanong sa form na ito'), mood: 'think' }}
      columns={[
        { label: '#', flex: 0.3, render: (x) => String(x.sort_order) },
        { label: tr('Question', 'Tanong'), flex: 3, render: (x) => x.text },
        { label: tr('Category', 'Kategorya'), flex: 1.2, render: (x) => x.category ?? '—', phone: true },
        { label: tr('Answer', 'Sagot'), render: (x) => (x.type === 'rating' ? tr('Rating 1–5', 'Rating 1–5') : tr('Written', 'Nakasulat')), phone: true },
        { label: tr('Filipino', 'Filipino'), render: (x) => (x.text_fil ? <Pill label={tr('Yes', 'Meron')} tone="green" /> : <Pill label={tr('Missing', 'Wala')} tone="grey" />) },
        { label: tr('Status', 'Status'), render: (x) => (x.is_active ? <Pill label={tr('On', 'On')} tone="green" /> : <Pill label={tr('Off', 'Off')} tone="grey" />), phone: true },
      ]}
      fields={[
        { key: 'audience', label: tr('Form', 'Form'), kind: 'select', required: true, options: [{ value: 'student', label: tr('Student form', 'Form ng estudyante') }, { value: 'peer', label: tr('Peer form', 'Peer form') }] },
        { key: 'type', label: tr('Answer type', 'Uri ng sagot'), kind: 'select', required: true, options: [{ value: 'rating', label: tr('Rating 1–5', 'Rating 1–5') }, { value: 'text', label: tr('Written answer', 'Nakasulat na sagot') }] },
        { key: 'text', label: tr('Question (English)', 'Tanong (English)'), kind: 'textarea', required: true, max: 500 },
        { key: 'text_fil', label: tr('Question (Filipino)', 'Tanong (Filipino)'), kind: 'textarea', max: 500 },
        { key: 'category', label: tr('Category (English)', 'Kategorya (English)'), kind: 'text', icon: 'layers', placeholder: 'Classroom management', max: 80, hint: tr('A short name shown on teacher dashboards', 'Maikling pangalan na makikita sa dashboard ng guro') },
        { key: 'category_fil', label: tr('Category (Filipino)', 'Kategorya (Filipino)'), kind: 'text', icon: 'layers', max: 80 },
        { key: 'sort_order', label: tr('Order', 'Pagkakasunod'), kind: 'number', icon: 'list', hint: tr('Lower numbers come first', 'Nauuna ang mas maliit na numero') },
        { key: 'is_active', label: tr('Show on the form', 'Ipakita sa form'), kind: 'toggle' },
      ]}
      toForm={(x) => ({ audience: x.audience, type: x.type, text: x.text, text_fil: x.text_fil, category: x.category, category_fil: x.category_fil, sort_order: x.sort_order, is_active: x.is_active })}
      blank={{ audience, type: 'rating', text: '', text_fil: '', category: '', category_fil: '', sort_order: '', is_active: true }}
    />
  );
}
