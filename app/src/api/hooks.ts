import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './client';
import { useAuth } from '@/auth/store';
import { getToken } from '@/auth/tokenStorage';
import { useEffect } from 'react';
import { useWiseConversations } from '@/lib/wiseConversations';
import type { AppNotification, ChatMessage, Comment, EvaluationForm, FacultyReport, HistoryItem, Paginated, PeerForm, StudentDashboard, TeacherDashboard, WiseState, WiseConversation } from './types';

export const keys = {
  studentDashboard: ['student', 'dashboard'] as const,
  form: (offeringId: number) => ['student', 'form', offeringId] as const,
  history: ['student', 'history'] as const,
  notifications: ['notifications'] as const,
  wise: ['wise'] as const,
};

export function useStudentDashboard() {
  return useQuery({ queryKey: keys.studentDashboard, queryFn: () => api<StudentDashboard>('/student/dashboard'), refetchOnMount: 'always', refetchInterval: 30_000 });
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
  const userId = useAuth((s) => s.user?.id);
  const selected = useWiseConversations((s) => userId ? s.active[userId] : undefined);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: [...keys.wise, userId, selected ?? 'latest'],
    enabled: !!userId,
    queryFn: async () => {
      const token = await getToken();
      if (useAuth.getState().user?.id !== userId) throw new ApiError(409, 'The signed-in account changed.');
      const result = await api<WiseState>(`/wise/messages${selected ? `?conversation_id=${selected}` : ''}`, { token });
      if (useAuth.getState().user?.id !== userId) throw new ApiError(409, 'The signed-in account changed.');
      if (!Array.isArray(result?.messages) || !Array.isArray(result?.suggestions)
        || typeof result.greeting !== 'string' || typeof result.tip !== 'string'
        || result.suggestions.some((suggestion) => typeof suggestion !== 'string')
        || result.messages.some((message) => !message || typeof message.id !== 'number' || typeof message.content !== 'string' || !['user', 'assistant'].includes(message.role))) {
        throw new ApiError(502, 'Wise could not load the conversation. Please refresh and try again.');
      }
      return result;
    },
  });
  useEffect(() => {
    if (selected !== undefined && query.error instanceof ApiError && query.error.status === 404 && userId) {
      qc.removeQueries({ queryKey: [...keys.wise, userId, 'latest'], exact: true });
      useWiseConversations.getState().select(userId, undefined);
      return;
    }
    const conversation = query.data?.conversation;
    if (userId && selected === undefined && conversation) {
      qc.setQueryData([...keys.wise, userId, conversation.id], query.data);
      useWiseConversations.getState().select(userId, conversation.id);
    }
  }, [userId, selected, query.data, query.error, qc]);
  return query;
}

export interface WiseSendInput { message: string; requestId: string; conversationId?: number }

export function useSendWise() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['wise', 'send'],
    networkMode: 'always',
    retry: false,
    mutationFn: async ({ message, requestId, conversationId }: WiseSendInput) => {
      const ownerId = useAuth.getState().user?.id;
      const token = await getToken();
      if (!ownerId || useAuth.getState().user?.id !== ownerId) throw new ApiError(409, 'The signed-in account changed.');
      const result = await api<{ question: ChatMessage; reply: ChatMessage; conversation: WiseConversation }>('/wise/messages', {
        method: 'POST', body: { message, request_id: requestId, conversation_id: conversationId }, timeoutMs: 150_000, token,
      });
      if (!result?.question?.id || !result?.reply?.id || !result?.conversation?.id || typeof result.reply.content !== 'string') {
        throw new ApiError(502, 'Wise returned an incomplete response. Please retry your message.');
      }
      return { ...result, ownerId };
    },
    onSuccess: ({ question, reply, ownerId, conversation }, input) => {
      if (useAuth.getState().user?.id !== ownerId) return;
      const key = [...keys.wise, ownerId, conversation.id];
      if (!qc.getQueryData(key)) {
        const prior = qc.getQueryData<WiseState>([...keys.wise, ownerId, input.conversationId ?? 'latest']);
        if (prior) qc.setQueryData(key, { ...prior, conversation });
      }
      qc.setQueryData<WiseState>(key, (old) => old ? {
        ...old,
        conversation,
        messages: [...new Map([...old.messages, question, reply].map((m) => [m.id, m])).values()].sort((a, b) => a.id - b.id),
      } : old);
      useWiseConversations.getState().select(ownerId, conversation.id);
      void qc.invalidateQueries({ queryKey: ['wise-conversations', ownerId] });
      if (!qc.getQueryData(key)) void qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useClearWise() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['wise', 'clear'],
    networkMode: 'always',
    retry: false,
    mutationFn: async (conversationId?: number) => {
      const ownerId = useAuth.getState().user?.id;
      const token = await getToken();
      if (!ownerId || useAuth.getState().user?.id !== ownerId) throw new ApiError(409, 'The signed-in account changed.');
      await api(`/wise/messages${conversationId ? `?conversation_id=${conversationId}` : ''}`, { method: 'DELETE', token });
      return { ownerId, conversationId };
    },
    onSuccess: ({ ownerId, conversationId }) => {
      if (useAuth.getState().user?.id !== ownerId) return;
      qc.setQueryData<WiseState>([...keys.wise, ownerId, conversationId ?? 'latest'], (old) => (old ? { ...old, messages: [], has_more_messages: false } : old));
    },
  });
}

export function useWiseHistory(enabled = true) {
  const userId = useAuth((s) => s.user?.id);
  return useInfiniteQuery({
    queryKey: ['wise-conversations', userId], enabled: !!userId && enabled, initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (useAuth.getState().user?.id !== userId) throw new ApiError(409, 'The signed-in account changed.');
      const result = await api<Paginated<WiseConversation>>(`/wise/conversations?page=${pageParam}`, { token });
      if (useAuth.getState().user?.id !== userId) throw new ApiError(409, 'The signed-in account changed.');
      return result;
    },
    getNextPageParam: (page) => page.current_page < page.last_page ? page.current_page + 1 : undefined,
  });
}

export function useNewWiseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['wise', 'new'], networkMode: 'always', retry: false,
    mutationFn: async () => {
      const ownerId = useAuth.getState().user?.id;
      const token = await getToken();
      if (!ownerId || useAuth.getState().user?.id !== ownerId) throw new ApiError(409, 'The signed-in account changed.');
      const result = await api<{ conversation: WiseConversation }>('/wise/conversations', { method: 'POST', token });
      if (!result?.conversation?.id) throw new ApiError(502, 'Wise could not create a conversation. Please try again.');
      return { ...result, ownerId };
    },
    onSuccess: ({ conversation, ownerId }) => {
      if (!ownerId || useAuth.getState().user?.id !== ownerId) return;
      useWiseConversations.getState().select(ownerId, conversation.id);
      void qc.invalidateQueries({ queryKey: ['wise-conversations', ownerId] });
    },
  });
}

export function useDeleteWiseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['wise', 'delete'], networkMode: 'always', retry: false,
    mutationFn: async (conversationId: number) => {
      const ownerId = useAuth.getState().user?.id;
      const token = await getToken();
      if (!ownerId || useAuth.getState().user?.id !== ownerId) throw new ApiError(409, 'The signed-in account changed.');
      await api(`/wise/conversations/${conversationId}`, { method: 'DELETE', token });
      return { ownerId, conversationId };
    },
    onSuccess: ({ ownerId, conversationId }) => {
      if (!ownerId || useAuth.getState().user?.id !== ownerId) return;
      qc.removeQueries({ queryKey: [...keys.wise, ownerId, conversationId], exact: true });
      qc.removeQueries({ queryKey: [...keys.wise, ownerId, 'latest'], exact: true });
      if (useWiseConversations.getState().active[ownerId] === conversationId) useWiseConversations.getState().select(ownerId, undefined);
      void qc.invalidateQueries({ queryKey: ['wise-conversations', ownerId] });
    },
  });
}

export function useEarlierWiseMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['wise', 'earlier'], retry: false,
    mutationFn: async ({ conversationId, beforeId }: { conversationId: number; beforeId: number }) => {
      const ownerId = useAuth.getState().user?.id;
      const token = await getToken();
      if (!ownerId || useAuth.getState().user?.id !== ownerId) throw new ApiError(409, 'The signed-in account changed.');
      const result = await api<WiseState>(`/wise/messages?conversation_id=${conversationId}&before_id=${beforeId}`, { token });
      return { result, ownerId, conversationId };
    },
    onSuccess: ({ result, ownerId, conversationId }) => {
      if (!ownerId || useAuth.getState().user?.id !== ownerId) return;
      qc.setQueryData<WiseState>([...keys.wise, ownerId, conversationId], (old) => old ? {
        ...old, has_more_messages: result.has_more_messages,
        messages: [...new Map([...result.messages, ...old.messages].map((message) => [message.id, message])).values()].sort((a, b) => a.id - b.id),
      } : old);
    },
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
    mutationFn: (body: { name?: string; email?: string | null; phone_number?: string | null }) => api<{ user: import('./types').User }>('/me/profile', { method: 'PUT', body }),
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
