import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import type { Role } from '@/api/types';
import { homeFor, useAuth } from '@/auth/store';

/** Only renders its children for a signed-in user with the given role. */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/login" />;
  if (user.role !== role) return <Redirect href={homeFor(user.role)} />;
  return <>{children}</>;
}
