import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const C = {
  primary: '#006947',
  text: '#00362a',
  textSec: '#2f6555',
  white: '#ffffff',
  low: '#bffee7',
  outline: '#81b8a5',
  font: Platform.OS === 'web' ? "'Plus Jakarta Sans', system-ui, sans-serif" : undefined,
  fontBody: Platform.OS === 'web' ? "'Manrope', system-ui, sans-serif" : undefined,
};

interface StitchAppBarProps {
  onBack?: () => void;
  title?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
}

export function StitchAppBar({ onBack, title, showSearch, showNotifications }: StitchAppBarProps) {
  const insets = useSafeAreaInsets();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 } as any}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={{ padding: 8, borderRadius: 12, backgroundColor: 'rgba(0,105,71,0.1)' }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={22} color="#006947" />
          </TouchableOpacity>
        ) : (
          <View style={{ padding: 8, borderRadius: 12, backgroundColor: '#00feb2' }}>
            <MaterialIcons name="spa" size={22} color="#006947" />
          </View>
        )}
        <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, fontStyle: 'italic', fontFamily: C.font, letterSpacing: -0.5 } as any}>
          {title ?? 'The Fluid Pantry'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 } as any}>
        {showSearch && (
          <TouchableOpacity style={{ padding: 8, borderRadius: 9999 }} activeOpacity={0.7}>
            <MaterialIcons name="search" size={22} color={C.textSec} />
          </TouchableOpacity>
        )}
        {showNotifications && (
          <TouchableOpacity style={{ padding: 8, borderRadius: 9999 }} activeOpacity={0.7}>
            <MaterialIcons name="notifications" size={22} color={C.textSec} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setShowProfileModal(true)}
          activeOpacity={0.7}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#b2f6de', borderWidth: 2, borderColor: '#9decd2' }}
        >
          <MaterialIcons name="person" size={20} color={C.textSec} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const profileModal = (
    <Modal visible={showProfileModal} transparent animationType="fade">
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,54,42,0.3)', justifyContent: 'center', paddingHorizontal: 24 }}
        activeOpacity={1}
        onPress={() => setShowProfileModal(false)}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[
            { backgroundColor: C.white, borderRadius: 24, padding: 24, gap: 16, maxWidth: 480, alignSelf: 'center', width: '100%' },
            Platform.OS === 'web' ? ({ boxShadow: '0px 10px 30px rgba(0,54,42,0.12)' } as any) : undefined,
          ]}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="person" size={32} color={C.textSec} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, fontFamily: C.font }}>Anonym bruker</Text>
              <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' }}>
                Brukerprofil er ikke implementert ennå.{'\n'}Du er logget inn anonymt.
              </Text>
            </View>
            <TouchableOpacity
              style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: C.low }}
              onPress={() => setShowProfileModal(false)}
            >
              <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600', fontFamily: C.fontBody }}>Lukk</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // On web: use CSS glass effect. On native: use BlurView
  if (Platform.OS === 'web') {
    return (
      <>
        {/* Spacer: 72px content + safe area top via CSS */}
        <View style={{ height: 'calc(72px + env(safe-area-inset-top, 0px))' } as any} />
        <View
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            backgroundColor: 'rgba(236,253,245,0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0px 10px 30px rgba(0,54,42,0.06)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 40,
          } as any}
        >
          {content}
        </View>
        {profileModal}
      </>
    );
  }

  return (
    <>
      <BlurView
        intensity={80}
        tint="light"
        style={{ paddingTop: insets.top, zIndex: 40 }}
      >
        {content}
      </BlurView>
      {profileModal}
    </>
  );
}
