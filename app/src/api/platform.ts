import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Paginated, PublicSchool } from './types';

export interface PlatformSchoolRow extends PublicSchool {
  status: 'pending' | 'active' | 'suspended';
  contact_name: string | null;
  contact_email: string | null;
  applied_at: string | null;
  approved_at: string | null;
  students?: number;
  teachers?: number;
}

export interface PlatformOverview {
  schools: { active: number; pending: number; suspended: number };
  people: { students: number; teachers: number; admins: number };
  evaluations: { total: number; last_30_days: number };
  errors_last_7_days: number;
  open_messages: number;
  pending: PlatformSchoolRow[];
  deletion_requests: PlatformSchoolRow[];
}

export interface PlatformSchoolDetail {
  school: PlatformSchoolRow & {
    contact_position: string | null;
    contact_phone: string | null;
    student_count: number | null;
    message: string | null;
    suspended_reason: string | null;
    deletion_requested_at: string | null;
    deletion_reason: string | null;
  };
  stats: { students: number; teachers: number; evaluations: number; last_active: string | null };
  admins: { id: number; name: string; email: string | null; username: string; department: string | null }[];
  admin_invites: { code: string; name: string | null; email: string | null; expires_at: string | null; usable: boolean }[];
}

export interface AdminInvite {
  code: string;
  name: string | null;
  email: string | null;
  expires_at: string;
}

export function usePlatformOverview() {
  return useQuery({ queryKey: ['platform', 'overview'], queryFn: () => api<PlatformOverview>('/platform/overview'), refetchInterval: 120_000 });
}

export function usePlatformSchools(status: string | null, search: string) {
  const qs = [status && `status=${status}`, search && `search=${encodeURIComponent(search)}`].filter(Boolean).join('&');
  return useQuery({ queryKey: ['platform', 'schools', status, search], queryFn: () => api<Paginated<PlatformSchoolRow>>(`/platform/schools${qs ? `?${qs}` : ''}`) });
}

export function usePlatformSchool(id: number) {
  return useQuery({ queryKey: ['platform', 'school', id], queryFn: () => api<PlatformSchoolDetail>(`/platform/schools/${id}`), enabled: Number.isFinite(id) });
}

/** approve · reject · suspend · activate · invite-admin · delete */
export function usePlatformAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, body }: { id: number; action: 'approve' | 'reject' | 'suspend' | 'activate' | 'invite-admin' | 'delete'; body?: Record<string, unknown> }) =>
      api<{ message?: string; invite?: AdminInvite }>(action === 'delete' ? `/platform/schools/${id}` : `/platform/schools/${id}/${action}`, { method: action === 'delete' ? 'DELETE' : 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform'] }),
  });
}

export interface PlatformError {
  id: number;
  message: string;
  stack: string | null;
  screen: string | null;
  platform: string | null;
  app_version: string | null;
  created_at: string;
  school: { id: number; name: string } | null;
}

export function usePlatformErrors() {
  return useQuery({ queryKey: ['platform', 'errors'], queryFn: () => api<Paginated<PlatformError>>('/platform/errors') });
}

export interface PlatformMessage {
  id: number;
  kind: 'contact' | 'problem';
  message: string;
  meta: Record<string, unknown> | null;
  status: 'open' | 'closed';
  created_at: string;
  user: { name: string; email: string | null; role: string; department: string | null } | null;
  school: { id: number; name: string; code: string } | null;
}

export function usePlatformMessages(status: 'open' | 'closed') {
  return useQuery({ queryKey: ['platform', 'messages', status], queryFn: () => api<Paginated<PlatformMessage> & { open_count: number }>(`/platform/messages?status=${status}`) });
}

export function useClosePlatformMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ message: string }>(`/platform/messages/${id}/close`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform'] }),
  });
}
