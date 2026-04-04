import { supabase } from './supabase';

// Sign up with email/password — creates a new account
export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;

  if (data.user) {
    await ensureUserProfile(data.user.id, displayName, 'email');
  }

  return data;
}

// Sign in with email/password
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  if (data.user) {
    await ensureUserProfile(data.user.id, undefined, 'email');
  }

  return data;
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Keep for backwards compat — used if we ever want anonymous again
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

async function ensureUserProfile(userId: string, displayName?: string, provider?: string) {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (!data) {
    await supabase.from('users').insert({
      id: userId,
      display_name: displayName ?? 'Anonym bruker',
      auth_provider: provider ?? 'anonymous',
      is_upgraded: provider === 'email',
    });
  } else if (provider === 'email' && displayName) {
    // Update display name and provider if upgrading from anonymous
    await supabase.from('users').update({
      display_name: displayName,
      auth_provider: 'email',
      is_upgraded: true,
    }).eq('id', userId);
  }
}
