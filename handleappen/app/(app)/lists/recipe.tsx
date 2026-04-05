import { Redirect } from 'expo-router';

// Redirect til ny felles importskjerm
export default function RecipeRedirect() {
  return <Redirect href="/(app)/lists/import" />;
}
