import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const householdId = useAuthStore((s) => s.householdId);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#d8fff0' }}>
        <ActivityIndicator size="large" color="#006947" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!householdId) {
    return <Redirect href="/(auth)/household" />;
  }

  return <Redirect href="/(app)/lists" />;
}
