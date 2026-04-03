import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

function generateInviteCode(): string {
  return uuidv4().slice(0, 8).toUpperCase();
}

export async function createHousehold(name: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const inviteCode = generateInviteCode();

  const { data: household, error: hError } = await supabase
    .from('households')
    .insert({ name, invite_code: inviteCode })
    .select()
    .single();

  if (hError) throw hError;

  const { error: uError } = await supabase
    .from('users')
    .update({ household_id: household.id })
    .eq('id', user.id);

  if (uError) throw uError;

  return household;
}

export async function joinHousehold(inviteCode: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: household, error: hError } = await supabase
    .from('households')
    .select()
    .eq('invite_code', inviteCode.toUpperCase().trim())
    .single();

  if (hError || !household) throw new Error('Ugyldig invitasjonskode');

  const { error: uError } = await supabase
    .from('users')
    .update({ household_id: household.id })
    .eq('id', user.id);

  if (uError) throw uError;

  return household;
}
