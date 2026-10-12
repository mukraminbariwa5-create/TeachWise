import { Redirect } from 'expo-router';
import { homeFor, useAuth } from '@/auth/store';

export default function Index() {
  const user = useAuth((s) => s.user);
  return <Redirect href={user ? homeFor(user.role) : '/login'} />;
}
