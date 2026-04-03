import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Index() {
  const householdId = useAuthStore((s) => s.householdId);

  if (householdId) {
    return <Redirect href="/(app)/lists" />;
  }

  return <Redirect href="/(auth)/household" />;
}
