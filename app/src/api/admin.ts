import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/store';
import { api } from './client';
import type { Paginated, Period, Person, SchoolInfo, User } from './types';

// ---------------------------------------------------------------- shapes

export interface AdminDashboard {
  semester: { id: number; name: string } | null;
  period: Period | null;
  stats: { faculty: number; students: number; evaluations_submitted: number; average_rating: number | null };
  completion: { completed: number; expected: number; percent: number; by_section: { section_id: number; label: string; completed: number; expected: number; percent: number }[] };
  faculty: (Person & { responses: number; average: number | null })[];
  periods: Period[];
}

export type AdminUser = User & { is_active: boolean };

export interface Section {
  id: number;
  program_id?: number | null;
  program?: { id: number; code: string; name: string; department_id: number | null } | null;
  course: string;
  year_level: number;
  name: string;
  label: string;
  students_count?: number;
  offerings_count?: number;
}

export interface Subject {
  id: number;
  department_id?: number | null;
  department?: { id: number; name: string; code: string | null } | null;
  code: string | null;
  name: string;
  year_level: number | null;
  units: number | null;
  offerings_count?: number;
}

export interface Semester {
  id: number;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
}

export interface Offering {
  id: number;
  subject: { id: number; code: string | null; name: string; units: number };
  section: string;
  schedule: string | null;
  teacher: Person;
  semester: string | null;
}

export type AdminPeriod = Period & { semester_id: number | null };

export interface AdminQuestion {
  id: number;
  audience: 'student' | 'peer';
  category: string | null;
  category_fil: string | null;
  text: string;
  text_fil: string | null;
  type: 'rating' | 'text';
  sort_order: number;
  is_active: boolean;
}

export interface ApprovedId {
  id: number;
  id_number: string;
  name: string | null;
  section_id: number | null;
  section: Section | null;
  notes: string | null;
  registered: boolean;
}

export interface PasswordRequest {
  id: number;
  status: 'pending' | 'resolved';
  note: string | null;
  requested_at: string;
  resolved_at: string | null;
  user: User;
}

export interface InboxMessage {
  id: number;
  kind: 'contact' | 'problem';
  message: string;
  meta: Record<string, unknown> | null;
  status: 'open' | 'closed';
  created_at: string;
  user: User | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  description: string;
  user: Person | null;
  ip_address: string | null;
  created_at: string;
}

export interface ClientErrorEntry {
  id: number;
  message: string;
  stack: string | null;
  screen: string | null;
  platform: string | null;
  app_version: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- hooks

const qs = (params: Record<string, string | number | null | undefined>) => {
  const p = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export function useAdminDashboard() {
  return useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<AdminDashboard>('/admin/dashboard') });
}

export function useSendReminders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ message: string; sent: number }>('/admin/reminders', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'activity'] }),
  });
}

/** Simple lists that come back as { data: [...] }. */
export function useAdminList<T>(resource: string, params: Record<string, string | number | null | undefined> = {}) {
  return useQuery({ queryKey: ['admin', resource, params], queryFn: () => api<{ data: T[] }>(`/admin/${resource}${qs(params)}`) });
}

/** Paginated lists (users, activity, inbox, errors). Loads more as you scroll. */
export function useAdminPages<T>(resource: string, params: Record<string, string | number | null | undefined> = {}) {
  return useInfiniteQuery({
    queryKey: ['admin', resource, params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Paginated<T> & { open_count?: number }>(`/admin/${resource}${qs({ ...params, page: pageParam })}`),
    getNextPageParam: (last) => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
  });
}

/** Create (no id) or update (with id) any admin resource. */
export function useAdminSave(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: Record<string, unknown> }) =>
      api<Record<string, unknown>>(`/admin/${resource}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useAdminDelete(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ message: string }>(`/admin/${resource}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function usePasswordRequests() {
  return useQuery({ queryKey: ['admin', 'password-requests'], queryFn: () => api<{ pending: number; data: PasswordRequest[] }>('/admin/password-requests'), refetchInterval: 60_000 });
}

export function useResolvePasswordRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ message: string; temporary_password: string }>(`/admin/password-requests/${id}/resolve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useCloseMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ message: string }>(`/admin/inbox/${id}/close`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

/** Counts for the sidebar badge and overview. */
export function useAdminCounts() {
  const schoolAdmin = useAuth((s) => s.user?.admin_scope !== 'department');
  const pw = usePasswordRequests();
  const inbox = useQuery({ queryKey: ['admin', 'inbox-count'], queryFn: () => api<{ open_count: number }>('/admin/inbox?status=open'), refetchInterval: 60_000, enabled: schoolAdmin });
  return { passwords: pw.data?.pending ?? 0, inbox: inbox.data?.open_count ?? 0 };
}

export function downloadFacultyCsv(periodId: number | null) {
  return api<string>(`/admin/reports/faculty.csv${qs({ period_id: periodId })}`, { raw: true });
}

// ---------------------------------------------------------------- multi-school


export interface SetupStep {
  key: 'profile' | 'departments' | 'semester' | 'teachers' | 'classes' | 'students' | 'period';
  done: boolean;
}

export interface AdminSchool {
  school: SchoolInfo & {
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    email_domains: string[];
    deletion_requested_at: string | null;
  };
  setup: { completed: boolean; steps: SetupStep[]; done: number; total: number };
}

export interface DepartmentRow {
  id: number;
  name: string;
  code: string | null;
  teachers_count: number;
  admins: string[];
  programs: { id: number; code: string; name: string; sections_count: number }[];
}

export interface InviteRow {
  id: number;
  code: string;
  role: 'teacher' | 'admin';
  department: string | null;
  name: string | null;
  email: string | null;
  status: 'waiting' | 'used' | 'expired';
  used_by: string | null;
  expires_at: string | null;
  created_at: string | null;
}

export function useAdminSchool() {
  return useQuery({ queryKey: ['admin', 'school'], queryFn: () => api<AdminSchool>('/admin/school') });
}

export function useSaveSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<AdminSchool>('/admin/school', { method: 'PUT', body }),
    onSuccess: (r) => {
      qc.setQueryData(['admin', 'school'], r);
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useDepartments() {
  return useQuery({ queryKey: ['admin', 'departments'], queryFn: () => api<{ data: DepartmentRow[] }>('/admin/departments') });
}

export function useInvites() {
  return useQuery({ queryKey: ['admin', 'invites'], queryFn: () => api<{ data: InviteRow[] }>('/admin/invites') });
}

export function useCreateInvites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { role: 'teacher' | 'admin'; department_id?: number | null; people: { name?: string; email?: string; id_number?: string }[] }) =>
      api<{ data: InviteRow[] }>('/admin/invites', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'invites'] }),
  });
}

export function useImportClasses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: { subject_code?: string; subject_name?: string; section: string; teacher: string; schedule?: string }[]) =>
      api<{ message: string; created: number; errors: { row: number; message: string }[] }>('/admin/import/classes', { method: 'POST', body: { rows } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}
