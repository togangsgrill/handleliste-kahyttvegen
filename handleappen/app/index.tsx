import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const householdId = useAuthStore((s) => s.householdId);

  // Not logged in — go to login
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Logged in but no household — go to household setup
  if (!householdId) {
    return <Redirect href="/(auth)/household" />;
  }

  // Logged in with household — go to app
  return <Redirect href="/(app)/lists" />;
}
