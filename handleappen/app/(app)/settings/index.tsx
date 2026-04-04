import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, ScrollView, Platform, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';
import { createHousehold, joinHousehold } from '@/lib/household';
import { signOut } from '@/lib/auth';

const C = {
  bg: '#d8fff0',
  white: '#ffffff',
  low: '#bffee7',
  container: '#b2f6de',
  high: '#a7f1d8',
  highest: '#9decd2',
  primary: '#006947',
  primaryContainer: '#00feb2',
  onPrimaryContainer: '#005c3e',
  text: '#00362a',
  textSec: '#2f6555',
  outline: '#81b8a5',
  secondaryContainer: '#5afcd2',
  error: '#b31b25',
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontBody: "'Manrope', system-ui, sans-serif",
};

const isWeb = Platform.OS === 'web';
const avatarColors = [C.primary, '#006575', '#006853', C.onPrimaryContainer];

interface Member { id: string; display_name: string; auth_provider: string; created_at: string }
interface Activity { action: string; item_name: string; created_at: string; user_id: string }

const ALLERGENS = [
  { key: 'gluten',      label: 'Gluten',         emoji: '🌾' },
  { key: 'laktose',     label: 'Laktose',         emoji: '🥛' },
  { key: 'egg',         label: 'Egg',             emoji: '🥚' },
  { key: 'peanøtter',   label: 'Peanøtter',       emoji: '🥜' },
  { key: 'trenøtter',   label: 'Trenøtter',       emoji: '🌰' },
  { key: 'fisk',        label: 'Fisk',            emoji: '🐟' },
  { key: 'skalldyr',    label: 'Skalldyr',        emoji: '🦐' },
  { key: 'soya',        label: 'Soya',            emoji: '🫘' },
  { key: 'selleri',     label: 'Selleri',         emoji: '🥬' },
  { key: 'sennep',      label: 'Sennep',          emoji: '🌿' },
  { key: 'sesamfrø',    label: 'Sesamfrø',        emoji: '🌱' },
  { key: 'svoveldioksid', label: 'Svoveldioksid', emoji: '🍷' },
  { key: 'lupin',       label: 'Lupin',           emoji: '🌼' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const householdId = useAuthStore((s) => s.householdId);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [copied, setCopied] = useState(false);

  // Allergener
  const [allergens, setAllergens] = useState<string[]>([]);
  const [savingAllergens, setSavingAllergens] = useState(false);
  const [allergensSaved, setAllergensSaved] = useState(false);

  // Account info
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  // Change household modal
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeMode, setChangeMode] = useState<'create' | 'join'>('join');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState('');

  useEffect(() => {
    // Fetch user account info
    if (session?.user) {
      setUserEmail(session.user.email ?? '');
      supabase.from('users').select('display_name').eq('id', session.user.id).single().then(({ data }) => {
        if (data) setUserDisplayName(data.display_name);
      });
    }

    if (!householdId) return;
    supabase.from('households').select('name, invite_code, allergens').eq('id', householdId).single().then(({ data }) => {
      if (data) { setHouseholdName(data.name); setInviteCode(data.invite_code); setAllergens(data.allergens ?? []); }
    });
    supabase.from('users').select('id, display_name, auth_provider, created_at').eq('household_id', householdId).order('created_at', { ascending: true }).then(({ data }) => {
      if (data) setMembers(data);
    });
    supabase.from('list_activity').select('action, item_name, created_at, user_id')
      .order('created_at', { ascending: false }).limit(10).then(({ data }) => {
        if (data) setActivity(data);
      });
  }, [householdId, session]);

  const toggleAllergen = (key: string) => {
    setAllergens((prev) =>
      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]
    );
    setAllergensSaved(false);
  };

  const handleSaveAllergens = async () => {
    if (!householdId) return;
    setSavingAllergens(true);
    await supabase.from('households').update({ allergens }).eq('id', householdId);
    setSavingAllergens(false);
    setAllergensSaved(true);
    setTimeout(() => setAllergensSaved(false), 2000);
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChangeHousehold = async () => {
    setChangeError('');
    setChanging(true);
    try {
      let household;
      if (changeMode === 'create') {
        if (!newHouseholdName.trim()) return;
        household = await createHousehold(newHouseholdName.trim());
      } else {
        if (!joinCode.trim()) return;
        household = await joinHousehold(joinCode.trim());
      }
      setHouseholdId(household.id);
      setShowChangeModal(false);
      setNewHouseholdName('');
      setJoinCode('');
      router.replace('/(app)/lists');
    } catch (e: any) {
      setChangeError(changeMode === 'join' ? 'Ugyldig invitasjonskode. Prøv igjen.' : String(e));
    } finally {
      setChanging(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      setSession(null);
      setHouseholdId(null);
      router.replace('/(auth)/login');
    } catch (e) {
      console.error('Logout error:', e);
      Alert.alert('Feil', 'Kunne ikke logge ut. Prøv igjen.');
    } finally {
      setLoggingOut(false);
    }
  };

  const memberNames = new Map(members.map((m) => [m.id, m.display_name]));
  const actionLabels: Record<string, string> = {
    added: 'la til', checked: 'handlet', unchecked: 'fjernet avhuking for', removed: 'slettet', edited: 'redigerte',
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: 'rgba(236,253,245,0.8)',
        paddingTop: insets.top + 8,
        zIndex: 40,
        ...(isWeb ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0px 10px 30px rgba(0,54,42,0.06)' } as any : {}),
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 } as any}>
            <MaterialIcons name="spa" size={22} color={C.primary} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, fontStyle: 'italic', letterSpacing: -0.5, fontFamily: C.font } as any}>Handleliste</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 120, maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any }}>

        {/* Title + change button */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 } as any}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 3, color: C.textSec, marginBottom: 8, textTransform: 'uppercase', fontFamily: C.fontBody } as any}>Innstillinger</Text>
            <Text style={{ fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -1, fontFamily: C.font } as any}>{householdName || 'Laster...'}</Text>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999, borderWidth: 1, borderColor: C.outline + '4D', marginTop: 8 } as any}
            onPress={() => setShowChangeModal(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="swap-horiz" size={16} color={C.primary} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>Bytt</Text>
          </TouchableOpacity>
        </View>

        {/* Members */}
        <View style={[{ backgroundColor: C.white, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.outline + '33', marginBottom: 20 }, isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.04)' } as any : {}]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 } as any}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Aktive medlemmer</Text>
            <View style={{ backgroundColor: C.primaryContainer, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: C.onPrimaryContainer, fontFamily: C.fontBody } as any}>{members.length} stk</Text>
            </View>
          </View>
          {members.length === 0 ? (
            <Text style={{ color: C.textSec, fontFamily: C.fontBody } as any}>Laster...</Text>
          ) : members.map((member, i) => {
            const isAdmin = i === 0;
            return (
              <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, backgroundColor: C.low, borderRadius: 16, marginBottom: 8 } as any}>
                <View style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: avatarColors[i % avatarColors.length] }}>
                  <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' } as any}>{member.display_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>{member.display_name}</Text>
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 9999,
                      backgroundColor: isAdmin ? C.primaryContainer : C.highest,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: isAdmin ? C.onPrimaryContainer : C.textSec, fontFamily: C.fontBody } as any}>
                        {isAdmin ? 'Admin' : 'Gjest'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2, fontFamily: C.fontBody } as any}>
                    {member.auth_provider === 'anonymous' ? 'Anonym bruker' : 'Registrert'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Invite card */}
        <View style={[{ backgroundColor: C.white, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.outline + '33', marginBottom: 20 }, isWeb ? { boxShadow: '0px 20px 40px rgba(0,54,42,0.08)' } as any : {}]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 } as any}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6, fontFamily: C.font } as any}>Inviter til husholdning</Text>
              <Text style={{ fontSize: 14, color: C.textSec, lineHeight: 20, maxWidth: 240, fontFamily: C.fontBody } as any}>Del invitasjonskoden med familie og venner.</Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.primaryContainer + '33', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.primaryContainer + '66' }}>
              <MaterialIcons name="share" size={20} color={C.primary} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(157,236,210,0.5)', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.outline + '4D', marginBottom: 12 } as any}>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: 4, color: C.primary, fontFamily: 'monospace' } as any}>{inviteCode || '—'}</Text>
            <TouchableOpacity style={{ backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999 }} onPress={handleCopyCode} activeOpacity={0.8}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff', fontFamily: C.fontBody } as any}>{copied ? 'Kopiert!' : 'Kopier'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: C.textSec + '99', textAlign: 'center', fontFamily: C.fontBody } as any}>Koden utløper etter 24 timer</Text>
        </View>

        {/* Allergener */}
        <View style={[{ backgroundColor: C.white, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.outline + '33', marginBottom: 20 }, isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.04)' } as any : {}]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 } as any}>
            <MaterialIcons name="warning-amber" size={20} color={C.primary} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Allergier og intoleranser</Text>
          </View>
          <Text style={{ fontSize: 13, color: C.textSec, fontFamily: C.fontBody, marginBottom: 20 } as any}>
            Merkte allergener vises på ingredienser under oppskriftsimport, med forslag til erstatninger.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 } as any}>
            {ALLERGENS.map((a) => {
              const active = allergens.includes(a.key);
              return (
                <TouchableOpacity
                  key={a.key}
                  onPress={() => toggleAllergen(a.key)}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
                    backgroundColor: active ? C.primary : C.low,
                    borderWidth: 1.5,
                    borderColor: active ? C.primary : C.outline + '44',
                  } as any}
                >
                  <Text style={{ fontSize: 15 } as any}>{a.emoji}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? C.white : C.textSec, fontFamily: C.fontBody } as any}>
                    {a.label}
                  </Text>
                  {active && <MaterialIcons name="check" size={14} color={C.white} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            onPress={handleSaveAllergens}
            disabled={savingAllergens}
            activeOpacity={0.8}
            style={{
              paddingVertical: 14, borderRadius: 14, alignItems: 'center',
              backgroundColor: allergensSaved ? C.primaryContainer : C.primary,
              flexDirection: 'row', justifyContent: 'center', gap: 8,
            } as any}
          >
            {savingAllergens
              ? <Text style={{ fontSize: 15, fontWeight: '700', color: C.white, fontFamily: C.fontBody } as any}>Lagrer...</Text>
              : allergensSaved
              ? <><MaterialIcons name="check" size={18} color={C.primary} /><Text style={{ fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>Lagret!</Text></>
              : <Text style={{ fontSize: 15, fontWeight: '700', color: C.white, fontFamily: C.fontBody } as any}>Lagre allergiprofil</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Recent activity */}
        {activity.length > 0 && (
          <View style={[{ backgroundColor: C.white, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.outline + '33', marginBottom: 20 }, isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.04)' } as any : {}]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 } as any}>
              <MaterialIcons name="history" size={20} color={C.primary} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Siste aktivitet</Text>
            </View>
            {activity.map((a, i) => (
              <View key={`${a.created_at}-${i}`} style={[
                { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 } as any,
                i < activity.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(129,184,165,0.15)' } : {},
              ]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginTop: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: C.text, lineHeight: 20, fontFamily: C.fontBody } as any}>
                    <Text style={{ fontWeight: '700' }}>{memberNames.get(a.user_id) ?? 'Ukjent'}</Text>
                    {' '}{actionLabels[a.action] ?? a.action}{' '}
                    <Text style={{ color: C.primary, fontWeight: '700' }}>{a.item_name}</Text>
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.textSec, marginTop: 3, fontFamily: C.fontBody } as any}>
                    {new Date(a.created_at).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Account / Logout */}
        <View style={[{ backgroundColor: C.white, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.outline + '33' }, isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.04)' } as any : {}]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 } as any}>
            <MaterialIcons name="person" size={20} color={C.primary} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Konto</Text>
          </View>

          <View style={{ gap: 12, marginBottom: 20 } as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, backgroundColor: C.low, borderRadius: 16 } as any}>
              <View style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: C.primary }}>
                <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' } as any}>
                  {(userDisplayName || userEmail || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>
                  {userDisplayName || 'Bruker'}
                </Text>
                <Text style={{ fontSize: 13, color: C.textSec, marginTop: 2, fontFamily: C.fontBody } as any}>
                  {userEmail || 'Ingen e-post'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
            style={{
              paddingVertical: 14, borderRadius: 14, alignItems: 'center',
              backgroundColor: 'rgba(179,27,37,0.08)',
              flexDirection: 'row', justifyContent: 'center', gap: 8,
              borderWidth: 1, borderColor: 'rgba(179,27,37,0.15)',
            } as any}
          >
            <MaterialIcons name="logout" size={18} color={C.error} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.error, fontFamily: C.fontBody } as any}>
              {loggingOut ? 'Logger ut...' : 'Logg ut'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change household modal */}
      <Modal visible={showChangeModal} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,54,42,0.35)', justifyContent: 'center', paddingHorizontal: 24 }} activeOpacity={1} onPress={() => { setShowChangeModal(false); setChangeError(''); }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: C.white, borderRadius: 24, padding: 28, gap: 16, maxWidth: 480, alignSelf: 'center', width: '100%', ...(isWeb ? { boxShadow: '0px 30px 60px rgba(0,54,42,0.15)' } as any : {}) } as any}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center', fontFamily: C.font } as any}>Bytt husholdning</Text>

              {/* Mode toggle */}
              <View style={{ flexDirection: 'row', backgroundColor: C.low, borderRadius: 12, padding: 4 } as any}>
                {(['join', 'create'] as const).map((m) => (
                  <TouchableOpacity key={m} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9, backgroundColor: changeMode === m ? C.white : 'transparent', ...(changeMode === m && isWeb ? { boxShadow: '0px 2px 8px rgba(0,54,42,0.08)' } as any : {}) }} onPress={() => { setChangeMode(m); setChangeError(''); }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: changeMode === m ? C.primary : C.textSec, fontFamily: C.fontBody } as any}>
                      {m === 'join' ? 'Bli med' : 'Opprett ny'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {changeMode === 'join' ? (
                <View style={{ gap: 8 } as any}>
                  <Text style={{ fontSize: 13, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
                    Skriv inn invitasjonskoden du har fått fra et husholdningsmedlem
                  </Text>
                  <TextInput
                    style={{ backgroundColor: C.low, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontWeight: '800', letterSpacing: 4, color: C.primary, fontFamily: 'monospace', borderWidth: 1, borderColor: 'rgba(129,184,165,0.3)', textAlign: 'center' } as any}
                    placeholder="INVKODE"
                    placeholderTextColor={C.outline}
                    value={joinCode}
                    onChangeText={setJoinCode}
                    autoCapitalize="characters"
                    autoFocus
                  />
                </View>
              ) : (
                <TextInput
                  style={{ backgroundColor: C.low, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: C.text, fontFamily: C.fontBody, borderWidth: 1, borderColor: 'rgba(129,184,165,0.3)' } as any}
                  placeholder="Navn på ny husholdning"
                  placeholderTextColor={C.outline}
                  value={newHouseholdName}
                  onChangeText={setNewHouseholdName}
                  autoFocus
                />
              )}

              {changeError ? <Text style={{ fontSize: 13, color: C.error, textAlign: 'center', fontFamily: C.fontBody } as any}>{changeError}</Text> : null}

              <View style={{ flexDirection: 'row', gap: 12 } as any}>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(129,184,165,0.3)' }} onPress={() => { setShowChangeModal(false); setChangeError(''); }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: C.primary, fontFamily: C.fontBody } as any}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: C.primary, opacity: changing || (changeMode === 'join' ? !joinCode.trim() : !newHouseholdName.trim()) ? 0.5 : 1 }}
                  onPress={handleChangeHousehold}
                  disabled={changing || (changeMode === 'join' ? !joinCode.trim() : !newHouseholdName.trim())}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff', fontFamily: C.fontBody } as any}>{changing ? '...' : changeMode === 'join' ? 'Bli med' : 'Opprett'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
