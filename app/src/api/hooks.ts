import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { AppNotification, ChatMessage, Comment, EvaluationForm, FacultyReport, HistoryItem, Paginated, PeerForm, StudentDashboard, TeacherDashboard, WiseState } from './types';

export const keys = {
  studentDashboard: ['student', 'dashboard'] as const,
  form: (offeringId: number) => ['student', 'form', offeringId] as const,
  history: ['student', 'history'] as const,
  notifications: ['notifications'] as const,
  wise: ['wise'] as const,
};

export function useStudentDashboard() {
  return useQuery({ queryKey: keys.studentDashboard, queryFn: () => api<StudentDashboard>('/student/dashboard') });
}

export function useEvaluationForm(offeringId: number) {
  return useQuery({
    queryKey: keys.form(offeringId),
    queryFn: () => api<EvaluationForm>(`/student/offerings/${offeringId}/form`),
    enabled: Number.isFinite(offeringId),
  });
}

export interface SubmitPayload {
  class_offering_id: number;
  answers: { question_id: number; rating?: number; answer_text?: string }[];
  comment?: string;
}

export function useSubmitEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitPayload) => api<{ message: string }>('/student/evaluations', { method: 'POST', body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student'] });
      qc.invalidateQueries({ queryKey: keys.wise });
    },
  });
}

export function useHistory() {
  return useQuery({ queryKey: keys.history, queryFn: () => api<{ data: HistoryItem[] }>('/student/history') });
}

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<{ unread: number; data: AppNotification[] }>('/notifications'),
    refetchInterval: 60_000,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; password: string; password_confirmation: string }) =>
      api<{ message: string }>('/auth/password', { method: 'PUT', body }),
  });
}

// ---- Professor Wise

export function useWise() {
  return useQuery({ queryKey: keys.wise, queryFn: () => api<WiseState>('/wise/messages') });
}

export function useSendWise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      api<{ question: ChatMessage; reply: ChatMessage }>('/wise/messages', { method: 'POST', body: { message } }),
    onSuccess: ({ question, reply }) => {
      qc.setQueryData<WiseState>(keys.wise, (old) => (old ? { ...old, messages: [...old.messages, question, reply] } : old));
    },
  });
}

export function useClearWise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/wise/messages', { method: 'DELETE' }),
    onSuccess: () => qc.setQueryData<WiseState>(keys.wise, (old) => (old ? { ...old, messages: [] } : old)),
  });
}

// ---- App info, account, sessions

export interface AppInfo {
  school_name: string;
  school: { id: number; name: string; short_name: string | null; code: string; logo_url: string | null } | null;
  support_email: string;
  dpo_email: string;
  /** TeachWise's own support address (for school admins). */
  platform_email?: string;
  latest_version: string;
  min_version: string;
  store_url: string;
}

export function useAppInfo() {
  return useQuery({ queryKey: ['app-info'], queryFn: () => api<AppInfo>('/app/info', { token: null }), staleTime: 3_600_000 });
}

export interface Session {
  id: number;
  device: string;
  last_used_at: string | null;
  created_at: string | null;
  expires_at: string | null;
  current: boolean;
}

export function useSessions() {
  return useQuery({ queryKey: ['sessions'], queryFn: () => api<{ data: Session[] }>('/me/sessions') });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | 'others') => api<{ message: string }>(id === 'others' ? '/me/sessions/others' : `/me/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (body: { email?: string | null; phone_number?: string | null }) => api<{ user: import('./types').User }>('/me/profile', { method: 'PUT', body }),
  });
}

export function useSendSupport() {
  return useMutation({
    mutationFn: (body: { kind: 'contact' | 'problem'; message: string; screen?: string }) => api<{ message: string }>('/support', { method: 'POST', body }),
  });
}

// ---- Teacher

export function useTeacherDashboard() {
  return useQuery({ queryKey: ['teacher', 'dashboard'], queryFn: () => api<TeacherDashboard>('/teacher/dashboard') });
}

export function useTeacherFeedback(offeringId: number | null) {
  return useInfiniteQuery({
    queryKey: ['teacher', 'feedback', offeringId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Paginated<Comment>>(`/teacher/feedback?page=${pageParam}${offeringId ? `&offering_id=${offeringId}` : ''}`),
    getNextPageParam: (last) => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
  });
}

export function useTeacherReport(periodId: number | null) {
  return useQuery({ queryKey: ['teacher', 'report', periodId], queryFn: () => api<FacultyReport>(`/teacher/report${periodId ? `?period_id=${periodId}` : ''}`) });
}

export function usePeerForm(peerId: number) {
  return useQuery({ queryKey: ['teacher', 'peer-form', peerId], queryFn: () => api<PeerForm>(`/teacher/peers/${peerId}/form`), enabled: Number.isFinite(peerId) });
}

export function useSubmitPeer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { teacher_id: number; answers: { question_id: number; rating?: number; answer_text?: string }[]; comment?: string }) =>
      api<{ message: string }>('/teacher/peer-evaluations', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher'] }),
  });
}

/** Admin: one teacher's full report. */
export function useFacultyReport(teacherId: number | null, periodId: number | null) {
  return useQuery({
    queryKey: ['admin', 'report', teacherId, periodId],
    queryFn: () => api<FacultyReport>(`/admin/reports/faculty/${teacherId}${periodId ? `?period_id=${periodId}` : ''}`),
    enabled: !!teacherId,
  });
}
