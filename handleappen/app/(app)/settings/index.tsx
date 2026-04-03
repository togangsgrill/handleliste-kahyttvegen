import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';
import { Spacing, Radius, contentMaxWidth } from '@/constants/theme';

interface Member {
  id: string;
  display_name: string;
  auth_provider: string;
}

interface Activity {
  action: string;
  item_name: string;
  created_at: string;
  user_id: string;
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const householdId = useAuthStore((s) => s.householdId);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [copied, setCopied] = useState(false);

  const c = {
    text: useThemeColor({}, 'text'),
    textSecondary: useThemeColor({}, 'textSecondary'),
    textTertiary: useThemeColor({}, 'textTertiary'),
    tint: useThemeColor({}, 'tint'),
    card: useThemeColor({}, 'card'),
    bgGrouped: useThemeColor({}, 'backgroundGrouped'),
    outlineVariant: useThemeColor({}, 'outlineVariant'),
    surfaceContainer: useThemeColor({}, 'surfaceContainer'),
    surfaceHigh: useThemeColor({}, 'surfaceContainerHigh'),
    surfaceLowest: useThemeColor({}, 'backgroundElevated'),
    onPrimary: useThemeColor({}, 'onPrimary'),
    primaryContainer: useThemeColor({}, 'primaryContainer'),
    separator: useThemeColor({}, 'separator'),
    success: useThemeColor({}, 'success'),
  };

  const isWide = width >= 600;

  useEffect(() => {
    if (!householdId) return;

    supabase.from('households').select('name, invite_code').eq('id', householdId).single().then(({ data }) => {
      if (data) { setHouseholdName(data.name); setInviteCode(data.invite_code); }
    });

    supabase.from('users').select('id, display_name, auth_provider')
      .eq('household_id', householdId).then(({ data }) => {
        if (data) setMembers(data);
      });

    supabase.from('list_activity').select('action, item_name, created_at, user_id')
      .order('created_at', { ascending: false }).limit(10).then(({ data }) => {
        if (data) setActivity(data);
      });
  }, [householdId]);

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const memberNames = new Map(members.map((m) => [m.id, m.display_name]));
  const actionLabels: Record<string, string> = {
    added: 'la til',
    checked: 'handlet',
    unchecked: 'fjernet avhuking for',
    removed: 'slettet',
    edited: 'redigerte',
  };

  const avatarColors = ['#006746', '#006575', '#00503f', '#004d59'];

  return (
    <ThemedView style={[styles.container, { backgroundColor: c.bgGrouped }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.sm },
          isWide && { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' },
        ]}
      >
        <Text style={[styles.largeTitle, { color: c.text }]}>👥 Administrer husholdning</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Delt matkonto for hele familien
        </Text>

        {/* Active Members */}
        <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>AKTIVE MEDLEMMER</Text>
        <View style={[styles.card, { backgroundColor: c.surfaceLowest, borderColor: c.outlineVariant }]}>
          <View style={styles.membersHeader}>
            <Text style={[styles.membersCount, { color: c.tint }]}>{members.length} medlemmer</Text>
          </View>
          {members.map((member, index) => (
            <View
              key={member.id}
              style={[
                styles.memberRow,
                index < members.length - 1 && { borderBottomColor: c.separator, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: avatarColors[index % avatarColors.length] }]}>
                <Text style={styles.avatarText}>{member.display_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: c.text }]}>{member.display_name}</Text>
                <Text style={[styles.memberRole, { color: c.textTertiary }]}>
                  {member.auth_provider === 'anonymous' ? 'Anonym' : 'Registrert'}
                </Text>
              </View>
              <View style={[styles.onlineDot, { backgroundColor: c.success }]} />
            </View>
          ))}
        </View>

        {/* Invite Link */}
        <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>INVITER VIA LINK</Text>
        <View style={[styles.card, { backgroundColor: c.surfaceLowest, borderColor: c.outlineVariant }]}>
          <Text style={[styles.inviteDesc, { color: c.textSecondary }]}>
            Del denne koden med familien slik at de kan bli med i husholdningen.
          </Text>
          <View style={styles.codeRow}>
            <View style={[styles.codeBox, { backgroundColor: c.surfaceContainer }]}>
              <Text style={[styles.codeText, { color: c.tint }]}>{inviteCode || '—'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.copyBtn, { backgroundColor: c.tint }]}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Text style={[styles.copyBtnText, { color: c.onPrimary }]}>
                {copied ? '✓ Kopiert' : '📋 Kopier'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        {activity.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>🕐 SISTE AKTIVITET</Text>
            <View style={[styles.card, { backgroundColor: c.surfaceLowest, borderColor: c.outlineVariant }]}>
              {activity.map((a, index) => (
                <View
                  key={`${a.created_at}-${index}`}
                  style={[
                    styles.activityRow,
                    index < activity.length - 1 && { borderBottomColor: c.separator, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={[styles.activityDot, { backgroundColor: c.tint }]} />
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityText, { color: c.text }]}>
                      <Text style={styles.activityName}>{memberNames.get(a.user_id) ?? 'Ukjent'}</Text>
                      {' '}{actionLabels[a.action] ?? a.action}{' '}
                      <Text style={styles.activityItem}>{a.item_name}</Text>
                    </Text>
                    <Text style={[styles.activityTime, { color: c.textTertiary }]}>
                      {new Date(a.created_at).toLocaleString('nb-NO', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  largeTitle: { fontSize: 28, fontWeight: '800', marginBottom: Spacing.xs },
  subtitle: { fontSize: 15, marginBottom: Spacing.xl, lineHeight: 20 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: Spacing.sm, marginTop: Spacing.md, paddingHorizontal: Spacing.xs },

  card: { borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, marginBottom: Spacing.sm },

  membersHeader: { marginBottom: Spacing.md },
  membersCount: { fontSize: 14, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#d8fff0', fontSize: 16, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600' },
  memberRole: { fontSize: 12, marginTop: 2 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },

  inviteDesc: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.md },
  codeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  codeBox: { flex: 1, paddingVertical: 14, paddingHorizontal: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  codeText: { fontSize: 20, fontWeight: '800', letterSpacing: 3, fontFamily: 'monospace' },
  copyBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: Radius.md },
  copyBtnText: { fontSize: 14, fontWeight: '700' },

  activityRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: Spacing.md },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 14, lineHeight: 20 },
  activityName: { fontWeight: '700' },
  activityItem: { fontWeight: '600', fontStyle: 'italic' },
  activityTime: { fontSize: 12, marginTop: 4 },
});
