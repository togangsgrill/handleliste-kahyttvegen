import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getChainInfo, type ChainInfo } from '@/constants/chains';

export interface StoreWithDistance {
  id: string;
  name: string;
  chain: string;
  chainInfo: ChainInfo;
  address: string | null;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useNearbyStores() {
  const [stores, setStores] = useState<StoreWithDistance[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    loadStoresAndLocation();
  }, []);

  async function loadStoresAndLocation() {
    setLoading(true);

    // Fetch all stores with coordinates
    const { data: allStores } = await (supabase
      .from('store_locations' as any)
      .select('id, name, chain, address, lat, lng')
      .not('lat', 'is', null) as any);

    // Try to get user location
    let userLat: number | null = null;
    let userLng: number | null = null;

    try {
      if (Platform.OS === 'web') {
        // Web: use navigator.geolocation
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
          });
        });
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
      } else {
        // Native: use expo-location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          userLat = loc.coords.latitude;
          userLng = loc.coords.longitude;
        } else {
          setLocationError('Tilgang til posisjon ble avslått');
        }
      }
    } catch {
      setLocationError('Kunne ikke hente posisjon');
    }

    if (userLat && userLng) {
      setUserLocation({ lat: userLat, lng: userLng });
    }

    // Build store list with distances
    const storesWithDistance: StoreWithDistance[] = (allStores ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      chain: s.chain,
      chainInfo: getChainInfo(s.chain),
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      distanceKm:
        userLat && userLng && s.lat && s.lng
          ? haversineKm(userLat, userLng, s.lat, s.lng)
          : null,
    }));

    // Sort: nearest first, then alphabetically for stores without distance
    storesWithDistance.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return a.name.localeCompare(b.name);
    });

    setStores(storesWithDistance);
    setLoading(false);
  }

  const nearest = stores.length > 0 && stores[0].distanceKm !== null ? stores[0] : null;

  return { stores, nearest, userLocation, loading, locationError, refresh: loadStoresAndLocation };
}
