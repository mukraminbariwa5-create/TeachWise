import { useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '@/api/client';
import { useAdminDelete, useAdminList, useAdminPages, useAdminSave, useCreateInvites, useDepartments, useInvites, type AdminUser, type InviteRow, type Section } from '@/api/admin';
import type { Role } from '@/api/types';
import { useAuth } from '@/auth/store';
import { DataList, SearchBox, Toolbar } from '@/components/admin/DataList';
import { FormSheet, type FieldDef, type FormValues } from '@/components/admin/FormSheet';
import { Button } from '@/components/Button';
import { useDebounced } from '@/components/form/Field';
import { InviteCodeSheet } from '@/components/InviteCodeSheet';
import { Txt } from '@/components/Txt';
import { Chip, confirm, Pill, Screen, Segmented, Sheet } from '@/components/ui';
import { ago } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { toast, useScrollHide } from '@/lib/ui';
import { colors, fonts, space, text } from '@/theme';

type PersonRole = Exclude<Role, 'platform'>;
const roleLabel = (r: PersonRole, deptAdmin?: boolean) => ({ student: tr('Student', 'Estudyante'), teacher: tr('Teacher', 'Guro'), admin: deptAdmin ? tr('Dept. admin', 'Admin ng dept.') : tr('Admin', 'Admin') })[r];

/** Everyone at the school: search and filter, add or edit accounts, and invite teachers and admins with codes. */
export default function PeopleScreen() {
  const params = useLocalSearchParams<{ invite?: string }>();
  const me = useAuth((s) => s.user);
  const school = useAuth((s) => s.school);
  const dept = me?.admin_scope === 'department';
  const [tab, setTab] = useState<'people' | 'invites'>('people');
  const [role, setRole] = useState<PersonRole | null>(null);
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim(), 350);
  const list = useAdminPages<AdminUser>('users', { role, search });
  const sections = useAdminList<Section>('sections');
  const departments = useDepartments();
  const save = useAdminSave('users');
  const del = useAdminDelete('users');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [inviting, setInviting] = useState(false);
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);
  const scrollHide = useScrollHide();

  useEffect(() => {
    if (params.invite) setInviting(true);
  }, [params.invite]);

  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const row = editing;
  const deptOptions = (departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name }));
  const self = row?.id === me?.id;
  const staff = !!row && row.role !== 'student';

  // Admins correct records; they never create accounts or choose anyone's password.
  const fields: FieldDef[] = [
    ...(staff && !dept && !self
      ? [{ key: 'role', label: tr('Role', 'Role'), kind: 'select', required: true, options: [{ value: 'teacher', label: tr('Teacher', 'Guro') }, { value: 'admin', label: tr('Admin', 'Admin') }] } as FieldDef]
      : []),
    { key: 'name', label: tr('Full name', 'Buong pangalan'), kind: 'text', icon: 'user', required: true, hint: tr('As in the school records', 'Gaya ng nasa records ng paaralan') },
    { key: 'id_number', label: tr('ID number', 'ID number'), kind: 'text', icon: 'clipboard', required: true },
    { key: 'email', label: tr('Email', 'Email'), kind: 'email' },
    ...(row?.role === 'student' ? [{ key: 'section_id', label: tr('Section', 'Section'), kind: 'select', searchable: true, icon: 'layers', options: (sections.data?.data ?? []).map((s) => ({ value: s.id, label: s.label })) } as FieldDef] : []),
    ...(dept || !staff || self
      ? []
      : [
          {
            key: 'department_id',
            label: tr('Department', 'Departamento'),
            kind: 'select',
            searchable: true,
            icon: 'layers',
            options: [{ value: null, label: tr('Whole school', 'Buong paaralan') }, ...deptOptions],
            hint: tr('For admins: a department makes them a department admin (dean or chair) who only manages that department.', 'Para sa admin: kapag may departamento, admin lang sila ng departamentong iyon (dean o chair).'),
          } as FieldDef,
        ]),
    ...(self ? [] : [{ key: 'is_active', label: tr('Account active', 'Aktibo ang account'), kind: 'toggle', hint: tr('Turn off when someone leaves. They can’t sign in, but their records stay.', 'I-off kapag umalis ang tao. Hindi na sila makakapag-sign in, pero mananatili ang records nila.') } as FieldDef]),
  ];

  const toForm = (u: AdminUser): FormValues => ({ role: u.role, name: u.name, id_number: u.id_number, email: u.email, section_id: u.section?.id ?? null, department_id: u.department_id ?? null, is_active: u.is_active });

  const givePassword = async () => {
    if (!row) return;
    const ok = await confirm({
      title: tr(`Give ${row.name} a temporary password?`, `Bigyan si ${row.name} ng temporary password?`),
      message: tr('Only for someone who can’t sign in. They’ll be signed out everywhere and should change it right away in Profile.', 'Para lang sa hindi makapag-sign in. Masa-sign out sila sa lahat ng device at dapat palitan agad sa Profile.'),
      confirmLabel: tr('Create password', 'Gumawa ng password'),
      mood: 'stern',
    });
    if (!ok) return;
    try {
      const r = await api<{ temporary_password: string }>(`/admin/users/${row.id}/temporary-password`, { method: 'POST' });
      setEditing(null);
      setTemp({ name: row.name, password: r.temporary_password });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t create a password.', 'Hindi nagawa ang password.') });
    }
  };

  return (
    <Screen title={tr('People', 'Mga tao')} subtitle={dept ? tr(`Students and teachers in ${me?.department ?? 'your department'}`, `Mga estudyante at guro sa ${me?.department ?? 'departamento mo'}`) : tr('Students, teachers and admins', 'Mga estudyante, guro at admin')} maxWidth={1100} right={<Button title={tr('Invite teachers', 'Mag-imbita ng guro')} onPress={() => setInviting(true)} />} {...scrollHide}>
      <Segmented
        label={tr('Show', 'Ipakita')}
        value={tab}
        onChange={setTab}
        options={[
          { key: 'people', label: tr('Accounts', 'Mga account'), icon: 'users' },
          { key: 'invites', label: tr('Invite codes', 'Mga invite code'), icon: 'key' },
        ]}
      />
      {tab === 'people' ? (
        <>
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder={tr('Search name, username or ID', 'Hanapin ang pangalan, username o ID')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
              <Chip label={tr('Everyone', 'Lahat')} on={role === null} onPress={() => setRole(null)} />
              {((dept ? ['student', 'teacher'] : ['student', 'teacher', 'admin']) as PersonRole[]).map((r) => (
                <Chip key={r} label={roleLabel(r)} on={role === r} onPress={() => setRole(r)} />
              ))}
            </ScrollView>
          </Toolbar>
          <DataList
            rows={rows}
            keyOf={(u) => u.id}
            loading={list.isLoading}
            onPress={(u) => setEditing(u)}
            hasMore={!!list.hasNextPage}
            loadingMore={list.isFetchingNextPage}
            onMore={() => list.fetchNextPage()}
            empty={
              search || role
                ? { title: tr('No matches', 'Walang tugma'), mood: 'think' }
                : { title: tr('Nobody has joined yet', 'Wala pang sumasali'), message: tr('Teachers join with the invite codes you send. Students create their own accounts once their ID is on Approved IDs.', 'Sumasali ang guro gamit ang invite code na ipapadala mo. Gumagawa ng sariling account ang estudyante kapag nasa Approved IDs na ang ID nila.'), action: { label: tr('Invite teachers', 'Mag-imbita ng guro'), onPress: () => setInviting(true) } }
            }
            columns={[
              { label: tr('Name', 'Pangalan'), flex: 2, render: (u) => u.name },
              { label: tr('ID number', 'ID number'), render: (u) => u.id_number, phone: true },
              { label: tr('Role', 'Role'), render: (u) => <Pill label={roleLabel(u.role as PersonRole, u.admin_scope === 'department')} tone={u.role === 'admin' ? 'orange' : u.role === 'teacher' ? 'green' : 'navy'} />, phone: true },
              { label: tr('Section / department', 'Section / departamento'), flex: 1.5, render: (u) => u.section?.label ?? u.department ?? '—' },
              { label: tr('Status', 'Status'), render: (u) => (u.is_active ? <Pill label={tr('Active', 'Aktibo')} tone="green" /> : <Pill label={tr('Inactive', 'Hindi aktibo')} tone="grey" />), phone: true },
            ]}
          />
        </>
      ) : (
        <InviteList />
      )}
      {row && (
        <FormSheet
          visible
          onClose={() => setEditing(null)}
          title={row.name}
          fields={fields}
          initial={toForm(row)}
          note={self ? tr('This is you. Change your password in Profile.', 'Ikaw ito. Palitan ang password mo sa Profile.') : `@${row.username}`}
          onSubmit={async (body) => {
            await save.mutateAsync({ id: row.id, body });
            toast({ title: tr('Saved', 'Na-save'), tone: 'success' });
          }}
          extraAction={self ? undefined : { label: tr('Give a temporary password', 'Magbigay ng temporary password'), onPress: givePassword }}
          onDelete={
            self
              ? undefined
              : async () => {
                  await del.mutateAsync(row.id);
                  toast({ title: tr('Account deleted', 'Nabura ang account'), tone: 'success' });
                }
          }
          deleteLabel={tr('Delete this account? Only for accounts made by mistake; people with classes or evaluations can only be turned off.', 'Burahin ang account? Para lang sa account na nagawa nang mali; ang may klase o evaluation ay puwede lang i-off.')}
        />
      )}
      <Sheet visible={!!temp} onClose={() => setTemp(null)} title={tr('Temporary password', 'Temporary password')}>
        {temp && (
          <View style={{ alignItems: 'center', gap: space.md }}>
            <Txt size={text.body} color={colors.textSoft} style={{ textAlign: 'center', lineHeight: 22 }}>{tr(`Give this to ${temp.name} in person or by private message. It’s shown only once.`, `Ibigay ito kay ${temp.name} nang personal o pribadong mensahe. Isang beses lang ito ipapakita.`)}</Txt>
            <View style={{ backgroundColor: colors.surface, borderRadius: 18, paddingVertical: space.md, paddingHorizontal: space.xl, borderWidth: 1.5, borderColor: colors.borderSoft, borderStyle: 'dashed' }}>
              <Txt weight="bold" size={text.h1} selectable style={{ letterSpacing: 2 }}>{temp.password}</Txt>
            </View>
          </View>
        )}
      </Sheet>
      <InviteSheet visible={inviting} onClose={() => setInviting(false)} schoolName={school?.name ?? ''} deptOnly={dept} departments={deptOptions as { value: number; label: string }[]} onCreated={() => setTab('invites')} />
    </Screen>
  );
}

function InviteList() {
  const q = useInvites();
  const del = useAdminDelete('invites');
  return (
    <DataList<InviteRow>
      rows={q.data?.data ?? []}
      keyOf={(i) => i.id}
      loading={q.isLoading}
      empty={{ title: tr('No invite codes yet', 'Wala pang invite code'), message: tr('Tap “Invite teachers” and paste their names. Each gets a one-time code.', 'Pindutin ang “Mag-imbita ng guro” at i-paste ang mga pangalan. May sariling code ang bawat isa.'), mood: 'point' }}
      columns={[
        { label: tr('Code', 'Code'), render: (i) => <Txt weight="bold" size={text.body} selectable style={{ letterSpacing: 1 }}>{i.code}</Txt> },
        { label: tr('For', 'Para kay'), flex: 1.6, render: (i) => i.name ?? i.email ?? tr('Anyone', 'Kahit sino'), phone: true },
        { label: tr('Role', 'Role'), flex: 1.4, render: (i) => (i.role === 'admin' ? (i.department ? tr(`Admin · ${i.department}`, `Admin · ${i.department}`) : tr('School admin', 'Admin ng paaralan')) : i.department ? tr(`Teacher · ${i.department}`, `Guro · ${i.department}`) : tr('Teacher', 'Guro')) },
        { label: tr('Status', 'Status'), render: (i) => (i.status === 'used' ? <Pill label={tr(`Joined${i.used_by ? `: ${i.used_by}` : ''}`, `Sumali${i.used_by ? `: ${i.used_by}` : ''}`)} tone="green" /> : i.status === 'expired' ? <Pill label={tr('Expired', 'Expired')} tone="grey" /> : <Pill label={tr(`Waiting · ${i.created_at ? ago(i.created_at) : ''}`, `Naghihintay · ${i.created_at ? ago(i.created_at) : ''}`)} tone="orange" />), phone: true },
      ]}
      right={(i) => (i.status === 'waiting' ? <Button title={tr('Cancel', 'Kanselahin')} variant="outline" onPress={() => del.mutate(i.id, { onSuccess: () => toast({ title: tr('Invite cancelled', 'Kinansela ang invite'), tone: 'success' }) })} /> : null)}
    />
  );
}

/** Paste names (one per line, optionally ", email"), pick the role and department, get one code each. */
function InviteSheet({ visible, onClose, schoolName, deptOnly, departments, onCreated }: { visible: boolean; onClose: () => void; schoolName: string; deptOnly: boolean; departments: { value: number; label: string }[]; onCreated: () => void }) {
  const create = useCreateInvites();
  const [role, setRole] = useState<'teacher' | 'admin'>('teacher');
  const [deptId, setDeptId] = useState<number | null>(null);
  const [raw, setRaw] = useState('');
  const [made, setMade] = useState<InviteRow[]>([]);
  const people = useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .map((l) => l.split(/\t|,|;/).map((p) => p.trim()))
        .filter((p) => p[0])
        .map(([name, email]) => ({ name, email: email && email.includes('@') ? email : undefined })),
    [raw]
  );

  const send = () =>
    create.mutate(
      { role, department_id: deptOnly ? undefined : deptId, people: people.length ? people : [{}] },
      {
        onSuccess: (r) => {
          setMade(r.data);
          setRaw('');
          onClose();
          onCreated();
        },
        onError: (e) => toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t create the invites.', 'Hindi nagawa ang invite.') }),
      }
    );

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={tr('Invite people', 'Mag-imbita')} maxWidth={600}>
        {!deptOnly && (
          <Segmented
            label={tr('Role', 'Role')}
            value={role}
            onChange={setRole}
            options={[
              { key: 'teacher', label: tr('Teachers', 'Mga guro'), icon: 'users' },
              { key: 'admin', label: tr('Admins', 'Mga admin'), icon: 'shield' },
            ]}
          />
        )}
        {!deptOnly && departments.length > 0 && (
          <View style={{ gap: space.xs }}>
            <Txt weight="medium" size={14} color={colors.textSoft}>{role === 'admin' ? tr('Admin for', 'Admin para sa') : tr('Department', 'Departamento')}</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
              <Chip label={role === 'admin' ? tr('Whole school', 'Buong paaralan') : tr('None', 'Wala')} on={deptId === null} onPress={() => setDeptId(null)} />
              {departments.map((d) => (
                <Chip key={d.value} label={d.label} on={deptId === d.value} onPress={() => setDeptId(d.value)} />
              ))}
            </ScrollView>
          </View>
        )}
        <Txt size={text.body} color={colors.textSoft} style={{ lineHeight: 22 }}>
          {tr('One name per line (add “, email” if you have it). Leave empty for a single code anyone can use once.', 'Isang pangalan bawat linya (dagdagan ng “, email” kung meron). Iwanang blangko para sa isang code na magagamit ng kahit sino nang isang beses.')}
        </Txt>
        <TextInput
          value={raw}
          onChangeText={setRaw}
          multiline
          placeholder={'Prof. Maria Santos, msantos@school.edu.ph\nProf. Ramon Cruz'}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={tr('Names to invite', 'Mga pangalang iimbitahan')}
          style={{ minHeight: 130, maxHeight: 260, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: space.md, fontFamily: fonts.regular, fontSize: 15, color: colors.text, textAlignVertical: 'top' }}
        />
        <Button
          title={people.length ? tr(`Create ${people.length} invite code${people.length === 1 ? '' : 's'}`, `Gumawa ng ${people.length} invite code`) : tr('Create one invite code', 'Gumawa ng isang invite code')}
          size="lg"
          loading={create.isPending}
          onPress={send}
        />
      </Sheet>
      <InviteCodeSheet visible={made.length > 0} onClose={() => setMade([])} invites={made} school={schoolName} role={role} />
    </>
  );
}
