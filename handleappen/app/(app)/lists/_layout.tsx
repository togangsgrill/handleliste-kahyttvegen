import { Stack } from 'expo-router';

export default function ListsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: true }} />
      <Stack.Screen name="import" options={{ headerShown: false }} />
      <Stack.Screen name="recipe" options={{ headerShown: false }} />
      <Stack.Screen name="recipes-list" options={{ headerShown: false }} />
      <Stack.Screen name="meal-plan" options={{ headerShown: false }} />
    </Stack>
  );
}
