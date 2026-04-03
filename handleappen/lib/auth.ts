import { supabase } from './supabase';

export async function ensureAnonymousSession() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    await ensureUserProfile(session.user.id);
    return session;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;

  if (data.session) {
    await ensureUserProfile(data.session.user.id);
  }

  return data.session;
}

async function ensureUserProfile(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (!data) {
    await supabase.from('users').insert({
      id: userId,
      display_name: 'Anonym bruker',
      auth_provider: 'anonymous',
      is_upgraded: false,
    });
  }
}
