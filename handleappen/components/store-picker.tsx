import { useState } from 'react';
import { Text, TouchableOpacity, View, Modal, ScrollView, Platform, TextInput, Image } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNearbyStores, type StoreWithDistance } from '@/hooks/useNearbyStores';
import type { ChainInfo } from '@/constants/chains';

const C = {
  white: '#ffffff', low: '#bffee7', container: '#b2f6de', high: '#a7f1d8', highest: '#9decd2',
  primary: '#006947', primaryContainer: '#00feb2', text: '#00362a', textSec: '#2f6555', outline: '#81b8a5',
  fontBody: Platform.OS === 'web' ? "'Manrope', system-ui, sans-serif" : undefined,
  font: Platform.OS === 'web' ? "'Plus Jakarta Sans', system-ui, sans-serif" : undefined,
};

function ChainLogo({ chainInfo, size = 40 }: { chainInfo: ChainInfo; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const radius = Math.round(size * 0.28);
  if (chainInfo.logoUrl && !imgError) {
    return (
      <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: chainInfo.bgColor, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: chainInfo.color + '22' }}>
        <Image
          source={{ uri: chainInfo.logoUrl }}
          style={{ width: size - 8, height: size - 8 }}
          resizeMode="contain"
          onError={() => setImgError(true)}
        />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: chainInfo.bgColor, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: chainInfo.color + '22' }}>
      <MaterialIcons name={chainInfo.icon as any} size={size * 0.5} color={chainInfo.color} />
    </View>
  );
}

interface StorePickerProps {
  selectedStoreId: string | null;
  onSelect: (store: StoreWithDistance) => void;
}

export function StorePicker({ selectedStoreId, onSelect }: StorePickerProps) {
  const { stores, nearest, loading, locationError } = useNearbyStores();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const filteredStores = search.trim()
    ? stores.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.chain.toLowerCase().includes(search.toLowerCase()) ||
        (s.address?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : stores;

  function handleSelect(store: StoreWithDistance) { onSelect(store); setVisible(false); setSearch(''); }

  function formatDistance(km: number | null): string {
    if (km === null) return '';
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }

  return (
    <>
      {/* Trigger */}
      <TouchableOpacity onPress={() => setVisible(true)} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            {selectedStore ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: selectedStore.chainInfo.color }} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>{selectedStore.name}</Text>
                </View>
                {selectedStore.address && (
                  <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2, fontFamily: C.fontBody } as any}>
                    {selectedStore.address}{selectedStore.distanceKm !== null ? ` · ${formatDistance(selectedStore.distanceKm)}` : ''}
                  </Text>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 15, color: C.textSec, fontFamily: C.fontBody } as any}>Velg butikk</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.low, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 } as any}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>Bytt</Text>
            <MaterialIcons name="expand-more" size={14} color={C.textSec} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,54,42,0.35)' }}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{
              backgroundColor: C.white,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: 560,
              ...(Platform.OS === 'web' ? { boxShadow: '0px -20px 60px rgba(0,54,42,0.15)' } as any : {}),
            }}>
              {/* Handle */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.outline + '66' }} />
              </View>

              <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, paddingHorizontal: 24, paddingBottom: 12, fontFamily: C.font } as any}>Velg butikk</Text>

              {/* Search */}
              <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: C.low, borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
                <MaterialIcons name="search" size={18} color={C.textSec} />
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: C.text, fontFamily: C.fontBody } as any}
                  placeholder="Søk etter butikk..."
                  placeholderTextColor={C.outline}
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                />
              </View>

              {/* Nearest suggestion */}
              {nearest && !search && !selectedStoreId && (
                <TouchableOpacity
                  style={{ marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: nearest.chainInfo.bgColor, borderWidth: 1, borderColor: nearest.chainInfo.color + '33' } as any}
                  onPress={() => handleSelect(nearest)}
                  activeOpacity={0.7}
                >
                  <ChainLogo chainInfo={nearest.chainInfo} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>Nærmest: {nearest.name}</Text>
                    <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>{nearest.address} · {formatDistance(nearest.distanceKm)}</Text>
                  </View>
                  <MaterialIcons name="arrow-forward" size={16} color={nearest.chainInfo.color} />
                </TouchableOpacity>
              )}

              {locationError && !search && (
                <Text style={{ fontSize: 12, color: C.textSec, paddingHorizontal: 24, marginBottom: 8, fontFamily: C.fontBody } as any}>{locationError}</Text>
              )}

              {/* Store list */}
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
                {loading ? (
                  <Text style={{ textAlign: 'center', color: C.textSec, paddingVertical: 32, fontFamily: C.fontBody } as any}>Laster butikker...</Text>
                ) : filteredStores.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: C.textSec, paddingVertical: 32, fontFamily: C.fontBody } as any}>Ingen butikker funnet</Text>
                ) : filteredStores.map((store) => (
                  <TouchableOpacity
                    key={store.id}
                    style={[
                      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(129,184,165,0.15)' } as any,
                      selectedStoreId === store.id ? { backgroundColor: 'rgba(0,105,71,0.05)', borderRadius: 12 } : {},
                    ]}
                    onPress={() => handleSelect(store)}
                    activeOpacity={0.7}
                  >
                    <ChainLogo chainInfo={store.chainInfo} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: C.text, fontSize: 15, fontFamily: C.fontBody } as any}>{store.name}</Text>
                      <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2, fontFamily: C.fontBody } as any}>
                        {store.address ?? store.chain}{store.distanceKm !== null ? ` · ${formatDistance(store.distanceKm)}` : ''}
                      </Text>
                    </View>
                    {selectedStoreId === store.id && <MaterialIcons name="check-circle" size={20} color={C.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
