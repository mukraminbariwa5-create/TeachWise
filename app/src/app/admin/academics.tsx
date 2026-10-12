import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ApiError } from '@/api/client';
import { useAdminDelete, useAdminList, useAdminSave, useDepartments, useImportClasses, type AdminUser, type DepartmentRow, type Offering, type Section, type Semester, type Subject } from '@/api/admin';
import { useAuth } from '@/auth/store';
import { CrudSection } from '@/components/admin/CrudSection';
import { FormSheet, type FieldDef } from '@/components/admin/FormSheet';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Chip, EmptyState, Pill, Screen, Sheet } from '@/components/ui';
import { inputDate, shortDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { toast, useScrollHide } from '@/lib/ui';
import { colors, fonts, shadowStyle, space, text } from '@/theme';

type Tab = 'departments' | 'classes' | 'sections' | 'subjects' | 'semesters';
const TABS: Tab[] = ['departments', 'classes', 'sections', 'subjects', 'semesters'];

/** The school's structure: departments and programs, sections, subjects, semesters, and who teaches each class. */
export default function AcademicsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const dept = useAuth((s) => s.user?.admin_scope === 'department');
  const term = useAuth((s) => s.school?.settings.term_label);
  const [tab, setTab] = useState<Tab>(TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'classes');
  const scrollHide = useScrollHide();
  useEffect(() => {
    if (TABS.includes(params.tab as Tab)) setTab(params.tab as Tab);
  }, [params.tab]);

  const labels: Record<Tab, string> = {
    departments: tr('Departments & programs', 'Departamento at programa'),
    classes: tr('Classes', 'Mga klase'),
    sections: tr('Sections', 'Mga section'),
    subjects: tr('Subjects', 'Mga subject'),
    semesters: term === 'trimester' ? tr('Trimesters', 'Mga trimester') : term === 'quarter' ? tr('Quarters', 'Mga quarter') : tr('Semesters', 'Mga semestre'),
  };
  const shown = TABS.filter((t) => !(dept && t === 'semesters'));

  return (
    <Screen title={tr('Classes & sections', 'Klase at section')} subtitle={tr('Departments, programs, sections, subjects and who teaches each class', 'Mga departamento, programa, section, subject at kung sino ang nagtuturo sa bawat klase')} maxWidth={1100} {...scrollHide}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }} accessibilityRole="tablist">
        {shown.map((t) => (
          <Chip key={t} label={labels[t]} on={tab === t} onPress={() => setTab(t)} />
        ))}
      </ScrollView>
      {tab === 'departments' && <Departments readOnly={dept} />}
      {tab === 'classes' && <Classes />}
      {tab === 'sections' && <Sections />}
      {tab === 'subjects' && <Subjects />}
      {tab === 'semesters' && <Semesters />}
    </Screen>
  );
}

function Classes() {
  const [section, setSection] = useState<number | null>(null);
  const teachers = useAdminList<AdminUser>('users', { role: 'teacher', per_page: 500 });
  const subjects = useAdminList<Subject>('subjects');
  const sections = useAdminList<Section>('sections');
  const semesters = useAdminList<Semester>('semesters');
  const sectionList = sections.data?.data ?? [];
  const [importing, setImporting] = useState(false);

  return (
    <View style={{ gap: space.md }}>
    <Pressable accessibilityRole="button" onPress={() => setImporting(true)} style={({ hovered }: { hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: hovered ? colors.chip : colors.brandSoft, borderRadius: 18, padding: space.md })}>
      <Icon name="upload" size={20} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Txt weight="semibold" size={text.body}>{tr('Import classes from a spreadsheet', 'Mag-import ng klase mula sa spreadsheet')}</Txt>
        <Txt size={text.small} color={colors.muted}>{tr('Paste rows of subject, section and teacher. New subjects and sections are created for you.', 'I-paste ang mga row ng subject, section at guro. Kusang gagawin ang bagong subject at section.')}</Txt>
      </View>
      <Icon name="chevronRight" size={16} color={colors.muted} strokeWidth={2.2} />
    </Pressable>
    <ImportClassesSheet visible={importing} onClose={() => setImporting(false)} />
    <CrudSection<Offering>
      resource="offerings"
      params={{ section_id: section }}
      noun={tr('class', 'klase')}
      note={tr('A class is one subject taught by one teacher to one section. Students in that section evaluate that teacher.', 'Ang klase ay isang subject na itinuturo ng isang guro sa isang section. Ie-evaluate ng mga estudyante sa section na iyon ang guro.')}
      search={(o, q) => [o.subject.code, o.subject.name, o.teacher.name, o.section].join(' ').toLowerCase().includes(q)}
      filters={
        sectionList.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            <Chip label={tr('All sections', 'Lahat ng section')} on={section === null} onPress={() => setSection(null)} />
            {sectionList.map((s) => (
              <Chip key={s.id} label={s.label} on={section === s.id} onPress={() => setSection(s.id)} />
            ))}
          </ScrollView>
        ) : undefined
      }
      empty={{ title: tr('No classes yet', 'Wala pang klase'), message: tr('Add sections and subjects first, then assign a teacher to each class.', 'Magdagdag muna ng section at subject, saka mag-assign ng guro sa bawat klase.') }}
      columns={[
        { label: tr('Subject', 'Subject'), flex: 2, render: (o) => [o.subject.code, o.subject.name].filter(Boolean).join(' · ') },
        { label: tr('Teacher', 'Guro'), flex: 1.5, render: (o) => o.teacher.name, phone: true },
        { label: tr('Section', 'Section'), render: (o) => o.section, phone: true },
        { label: tr('Schedule', 'Iskedyul'), flex: 1.3, render: (o) => o.schedule ?? '—' },
      ]}
      fields={[
        { key: 'subject_id', label: tr('Subject', 'Subject'), kind: 'select', searchable: true, icon: 'book', required: true, options: (subjects.data?.data ?? []).map((s) => ({ value: s.id, label: [s.code, s.name].filter(Boolean).join(' · ') })) },
        { key: 'teacher_id', label: tr('Teacher', 'Guro'), kind: 'select', searchable: true, icon: 'user', required: true, options: (teachers.data?.data ?? []).map((t) => ({ value: t.id, label: t.name, hint: t.department ?? undefined })) },
        { key: 'section_id', label: tr('Section', 'Section'), kind: 'select', searchable: true, icon: 'layers', required: true, options: sectionList.map((s) => ({ value: s.id, label: s.label })) },
        { key: 'semester_id', label: tr('Semester', 'Semestre'), kind: 'select', icon: 'calendar', searchable: true, options: (semesters.data?.data ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.is_active ? tr('Current', 'Kasalukuyan') : undefined })) },
        { key: 'schedule', label: tr('Schedule', 'Iskedyul'), kind: 'text', icon: 'clock', placeholder: 'MWF 9:00–10:00 AM' },
      ]}
      toForm={(o) => ({
        subject_id: o.subject.id,
        teacher_id: o.teacher.id,
        section_id: sectionList.find((s) => s.label === o.section)?.id ?? null,
        semester_id: (semesters.data?.data ?? []).find((s) => s.name === o.semester)?.id ?? null,
        schedule: o.schedule,
      })}
      blank={{ subject_id: null, teacher_id: null, section_id: section, semester_id: (semesters.data?.data ?? []).find((s) => s.is_active)?.id ?? null, schedule: '' }}
    />
    </View>
  );
}

function Sections() {
  const departments = useDepartments();
  const programs = (departments.data?.data ?? []).flatMap((d) => d.programs.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, hint: d.name })));
  return (
    <CrudSection<Section>
      resource="sections"
      noun={tr('section', 'section')}
      search={(s, q) => s.label.toLowerCase().includes(q)}
      empty={{ title: tr('No sections yet', 'Wala pang section'), message: tr('For example: course BSIT, year 3, section A makes “BSIT 3A”.', 'Halimbawa: course BSIT, year 3, section A ay “BSIT 3A”.') }}
      columns={[
        { label: tr('Section', 'Section'), flex: 1.5, render: (s) => s.label },
        { label: tr('Program', 'Programa'), flex: 1.5, render: (s) => s.program?.name ?? tr('No program yet', 'Wala pang programa') },
        { label: tr('Students', 'Estudyante'), align: 'right', render: (s) => String(s.students_count ?? 0), phone: true },
        { label: tr('Classes', 'Klase'), align: 'right', render: (s) => String(s.offerings_count ?? 0), phone: true },
      ]}
      fields={[
        { key: 'program_id', label: tr('Program', 'Programa'), kind: 'select', searchable: true, icon: 'book', options: programs, hint: tr('Sets the course code (e.g. BSIT) and the department.', 'Itinatakda ang course code (hal. BSIT) at departamento.') },
        { key: 'course', label: tr('Course code (if no program)', 'Course code (kung walang programa)'), kind: 'text', icon: 'book', placeholder: 'BSIT', max: 20, visibleIf: (v) => !v.program_id },
        { key: 'year_level', label: tr('Year level', 'Year level'), kind: 'number', icon: 'layers', required: true, placeholder: '3' },
        { key: 'name', label: tr('Section name', 'Pangalan ng section'), kind: 'text', icon: 'edit', required: true, placeholder: 'A', max: 10 },
      ]}
      toForm={(s) => ({ program_id: s.program_id ?? null, course: s.course, year_level: s.year_level, name: s.name })}
      blank={{ program_id: null, course: '', year_level: '', name: '' }}
    />
  );
}

function Subjects() {
  const dept = useAuth((s) => s.user?.admin_scope === 'department');
  const departments = useDepartments();
  return (
    <CrudSection<Subject>
      resource="subjects"
      noun={tr('subject', 'subject')}
      search={(s, q) => `${s.code ?? ''} ${s.name}`.toLowerCase().includes(q)}
      empty={{ title: tr('No subjects yet', 'Wala pang subject') }}
      columns={[
        { label: tr('Subject', 'Subject'), flex: 2.5, render: (s) => s.name },
        { label: tr('Code', 'Code'), render: (s) => s.code ?? '—', phone: true },
        { label: tr('Department', 'Departamento'), flex: 1.5, render: (s) => s.department?.name ?? '—' },
        { label: tr('Units', 'Units'), align: 'right', render: (s) => (s.units == null ? '—' : String(s.units)) },
        { label: tr('Classes', 'Klase'), align: 'right', render: (s) => String(s.offerings_count ?? 0), phone: true },
      ]}
      fields={[
        { key: 'code', label: tr('Code', 'Code'), kind: 'text', icon: 'clipboard', placeholder: 'IT 301', max: 20 },
        { key: 'name', label: tr('Subject name', 'Pangalan ng subject'), kind: 'text', icon: 'book', required: true, placeholder: 'Data Communications', max: 150 },
        ...(dept ? [] : [{ key: 'department_id', label: tr('Department', 'Departamento'), kind: 'select', searchable: true, icon: 'layers', options: (departments.data?.data ?? []).map((d) => ({ value: d.id, label: d.name })) } as FieldDef]),
        { key: 'year_level', label: tr('Year level', 'Year level'), kind: 'number', icon: 'layers' },
        { key: 'units', label: tr('Units', 'Units'), kind: 'number', icon: 'grid' },
      ]}
      toForm={(s) => ({ code: s.code, name: s.name, department_id: s.department_id ?? null, year_level: s.year_level, units: s.units })}
      blank={{ code: '', name: '', department_id: null, year_level: '', units: '' }}
    />
  );
}

function Semesters() {
  return (
    <CrudSection<Semester>
      resource="semesters"
      noun={tr('semester', 'semestre')}
      note={tr('Only one semester can be current. Making this one current switches the others off.', 'Isang semestre lang ang puwedeng kasalukuyan. Mao-off ang iba kapag ginawa itong kasalukuyan.')}
      empty={{ title: tr('No semesters yet', 'Wala pang semestre'), message: tr('Add the current semester so dashboards know which classes to show.', 'Idagdag ang kasalukuyang semestre para alam ng dashboard kung aling klase ang ipapakita.') }}
      columns={[
        { label: tr('Semester', 'Semestre'), flex: 2, render: (s) => s.name },
        { label: tr('Dates', 'Petsa'), flex: 2, render: (s) => (s.starts_on ? `${shortDate(s.starts_on)} – ${s.ends_on ? shortDate(s.ends_on) : '…'}` : '—'), phone: true },
        { label: tr('Status', 'Status'), render: (s) => (s.is_active ? <Pill label={tr('Current', 'Kasalukuyan')} tone="green" /> : <Pill label={tr('Past / future', 'Nakaraan / susunod')} tone="grey" />), phone: true },
      ]}
      fields={[
        { key: 'name', label: tr('Name', 'Pangalan'), kind: 'text', icon: 'calendar', required: true, placeholder: '1st Semester 2026–2027', max: 60 },
        { key: 'starts_on', label: tr('Starts', 'Simula'), kind: 'date' },
        { key: 'ends_on', label: tr('Ends', 'Katapusan'), kind: 'date' },
        { key: 'is_active', label: tr('Current semester', 'Kasalukuyang semestre'), kind: 'toggle' },
      ]}
      toForm={(s) => ({ name: s.name, starts_on: inputDate(s.starts_on), ends_on: inputDate(s.ends_on), is_active: s.is_active })}
      blank={{ name: '', starts_on: '', ends_on: '', is_active: false }}
    />
  );
}

/** Departments (colleges) with their programs. Department admins see only theirs, read-only. */
function Departments({ readOnly }: { readOnly: boolean }) {
  const q = useDepartments();
  const saveDept = useAdminSave('departments');
  const delDept = useAdminDelete('departments');
  const saveProgram = useAdminSave('programs');
  const delProgram = useAdminDelete('programs');
  const [dept, setDept] = useState<DepartmentRow | 'new' | null>(null);
  const [program, setProgram] = useState<{ id?: number; code: string; name: string; department_id: number } | null>(null);
  const list = q.data?.data ?? [];
  const editingDept = dept && dept !== 'new' ? dept : null;

  return (
    <View style={{ gap: space.md }}>
      {!readOnly && <Button title={tr('Add department', 'Magdagdag ng departamento')} onPress={() => setDept('new')} style={{ alignSelf: 'flex-start' }} />}
      {list.length === 0 && !q.isLoading && (
        <EmptyState mood="idea" title={tr('No departments yet', 'Wala pang departamento')} message={tr('Add your colleges or departments (e.g. College of Computer Studies), then their programs (BSIT, BSCS…).', 'Idagdag ang mga kolehiyo o departamento (hal. College of Computer Studies), saka ang mga programa (BSIT, BSCS…).')} />
      )}
      {list.map((d) => (
        <View key={d.id} style={[{ backgroundColor: colors.card, borderRadius: 24, padding: space.lg, gap: space.sm }, shadowStyle('soft')]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}>
              <Txt weight="bold" size={text.small} color={colors.accent}>{(d.code ?? d.name).slice(0, 4).toUpperCase()}</Txt>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="semibold" size={text.title} numberOfLines={2}>{d.name}</Txt>
              <Txt size={text.small} color={colors.muted}>
                {[tr(`${d.teachers_count} teachers`, `${d.teachers_count} guro`), d.admins.length ? tr(`Admin: ${d.admins.join(', ')}`, `Admin: ${d.admins.join(', ')}`) : null].filter(Boolean).join(' · ')}
              </Txt>
            </View>
            {!readOnly && <Button title={tr('Edit', 'I-edit')} variant="outline" onPress={() => setDept(d)} />}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {d.programs.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                disabled={readOnly}
                onPress={() => setProgram({ id: p.id, code: p.code, name: p.name, department_id: d.id })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, height: 34, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft }}
              >
                <Txt weight="semibold" size={text.small}>{p.code}</Txt>
                <Txt size={text.small} color={colors.muted}>{tr(`${p.sections_count} sections`, `${p.sections_count} section`)}</Txt>
              </Pressable>
            ))}
            {!readOnly && (
              <Pressable accessibilityRole="button" onPress={() => setProgram({ code: '', name: '', department_id: d.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, height: 34, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border }}>
                <Icon name="plus" size={14} color={colors.accent} strokeWidth={2.4} />
                <Txt weight="semibold" size={text.small} color={colors.accent}>{tr('Program', 'Programa')}</Txt>
              </Pressable>
            )}
          </View>
        </View>
      ))}

      <FormSheet
        visible={dept !== null}
        onClose={() => setDept(null)}
        title={editingDept ? tr('Edit department', 'I-edit ang departamento') : tr('New department', 'Bagong departamento')}
        fields={[
          { key: 'name', label: tr('Name', 'Pangalan'), kind: 'text', icon: 'book', required: true, placeholder: 'College of Computer Studies', max: 150 },
          { key: 'code', label: tr('Short code', 'Maikling code'), kind: 'text', icon: 'edit', placeholder: 'CCS', max: 20 },
        ]}
        initial={editingDept ? { name: editingDept.name, code: editingDept.code } : { name: '', code: '' }}
        onSubmit={async (body) => {
          await saveDept.mutateAsync({ id: editingDept?.id, body });
          toast({ title: tr('Saved', 'Na-save'), tone: 'success' });
        }}
        onDelete={editingDept ? async () => { await delDept.mutateAsync(editingDept.id); } : undefined}
        deleteLabel={tr('Delete this department?', 'Burahin ang departamento?')}
      />
      <FormSheet
        visible={program !== null}
        onClose={() => setProgram(null)}
        title={program?.id ? tr('Edit program', 'I-edit ang programa') : tr('New program', 'Bagong programa')}
        fields={[
          { key: 'code', label: tr('Code', 'Code'), kind: 'text', icon: 'edit', required: true, placeholder: 'BSIT', max: 20, hint: tr('Used in section names, e.g. BSIT 3-A', 'Gamit sa pangalan ng section, hal. BSIT 3-A') },
          { key: 'name', label: tr('Name', 'Pangalan'), kind: 'text', icon: 'book', required: true, placeholder: 'BS Information Technology', max: 150 },
          { key: 'department_id', label: tr('Department', 'Departamento'), kind: 'select', required: true, searchable: true, options: list.map((d) => ({ value: d.id, label: d.name })) },
        ]}
        initial={program ? { code: program.code, name: program.name, department_id: program.department_id } : {}}
        onSubmit={async (body) => {
          await saveProgram.mutateAsync({ id: program?.id, body });
          toast({ title: tr('Saved', 'Na-save'), tone: 'success' });
        }}
        onDelete={program?.id ? async () => { await delProgram.mutateAsync(program.id!); } : undefined}
        deleteLabel={tr('Delete this program?', 'Burahin ang programa?')}
      />
    </View>
  );
}

/** Paste class assignments from Excel or Google Sheets: subject code, subject name, section, teacher, schedule. */
function ImportClassesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const importer = useImportClasses();
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<{ message: string; errors: { row: number; message: string }[] } | null>(null);
  const rows = useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .map((l) => l.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => p.trim().replace(/^"|"$/g, '')))
        .filter((p) => p.length >= 3 && p.some(Boolean) && !/^subject/i.test(p[0]))
        .map(([subject_code, subject_name, section, teacher, schedule]) => ({ subject_code: subject_code || undefined, subject_name: subject_name || undefined, section, teacher, schedule: schedule || undefined })),
    [raw]
  );

  const run = () =>
    importer.mutate(rows, {
      onSuccess: (r) => {
        setResult(r);
        toast({ title: r.message, tone: r.errors.length ? 'info' : 'success' });
        if (!r.errors.length) {
          setRaw('');
          onClose();
        }
      },
      onError: (e) => toast({ title: e instanceof ApiError ? e.firstMessage : tr('Couldn’t import.', 'Hindi na-import.') }),
    });

  return (
    <Sheet visible={visible} onClose={onClose} title={tr('Import classes', 'Mag-import ng klase')} maxWidth={680}>
      <Txt size={text.body} color={colors.textSoft} style={{ lineHeight: 22 }}>
        {tr('One class per line, in this order. Copy the columns straight from your spreadsheet. Teachers must already have an account or invite.', 'Isang klase bawat linya, sa ayos na ito. Kopyahin ang mga column mula sa spreadsheet. Dapat may account o invite na ang guro.')}
      </Txt>
      <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: space.sm, gap: 2 }}>
        <Txt weight="semibold" size={text.small} color={colors.muted}>{tr('Subject code · Subject name · Section · Teacher (ID, username or name) · Schedule', 'Subject code · Pangalan ng subject · Section · Guro (ID, username o pangalan) · Iskedyul')}</Txt>
        <Txt size={text.small} color={colors.muted} style={{ fontFamily: fonts.regular }}>{'IT 301, Data Communications, BSIT 3A, T-002, MWF 9:00-10:00'}</Txt>
      </View>
      <TextInput
        value={raw}
        onChangeText={(v) => {
          setRaw(v);
          setResult(null);
        }}
        multiline
        placeholder={tr('Paste rows here…', 'I-paste ang mga row dito…')}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={tr('Classes to import', 'Mga klaseng ii-import')}
        style={{ minHeight: 160, maxHeight: 300, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: space.md, fontFamily: fonts.regular, fontSize: 14, color: colors.text, textAlignVertical: 'top' }}
      />
      {result && result.errors.length > 0 && (
        <View style={{ backgroundColor: colors.pendingBg, borderRadius: 14, padding: space.sm, gap: 4 }}>
          {result.errors.slice(0, 8).map((e) => (
            <Txt key={e.row} size={text.small} color={colors.pendingFg}>{tr(`Row ${e.row}: ${e.message}`, `Row ${e.row}: ${e.message}`)}</Txt>
          ))}
          {result.errors.length > 8 && <Txt size={text.small} color={colors.pendingFg}>{tr(`…and ${result.errors.length - 8} more`, `…at ${result.errors.length - 8} pa`)}</Txt>}
        </View>
      )}
      <Button title={rows.length ? tr(`Import ${rows.length} class${rows.length === 1 ? '' : 'es'}`, `I-import ang ${rows.length} klase`) : tr('Import', 'I-import')} size="lg" disabled={!rows.length} loading={importer.isPending} onPress={run} />
    </Sheet>
  );
}
