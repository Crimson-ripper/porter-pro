import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LatLng, Place } from '@porter/shared';
import { api } from '../lib/session';
import { Button, ErrorText, Input, colors, styles } from '../ui';

// Search an address, or move the map under a fixed pin to choose a spot.
export function PlaceSearchScreen({
  title,
  near,
  onSelect,
  onBack,
}: {
  title: string;
  near: LatLng | null;
  onSelect: (place: Place) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'search' | 'map'>('search');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [center, setCenter] = useState<LatLng | null>(near);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search. Nominatim allows ~1 request/second, so wait for typing to pause.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const nearQs = near ? `&lat=${near.lat}&lng=${near.lng}` : '';
        const res = await api.get<{ places: Place[] }>(`/geo/search?q=${encodeURIComponent(q.trim())}${nearQs}`);
        setResults(res.places);
        if (!res.places.length) setError('No places found. Try another name or choose on the map.');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 900);
  }, [q]);

  async function confirmMapPoint() {
    if (!center) return;
    setLoading(true);
    try {
      const res = await api.get<{ place: Place }>(`/geo/reverse?lat=${center.lat}&lng=${center.lng}`);
      onSelect(res.place);
    } catch {
      onSelect({ ...center, address: `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` });
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'map') {
    const start = near ?? { lat: 28.6315, lng: 77.2167 };
    return (
      <View style={{ flex: 1 }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: start.lat, longitude: start.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          onRegionChangeComplete={(r: Region) => setCenter({ lat: r.latitude, lng: r.longitude })}
          showsUserLocation
        />
        <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -40 }}>
          <Text style={{ fontSize: 36 }}>📍</Text>
        </View>
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, gap: 10 }}>
          <Button title={`Confirm ${title.toLowerCase()}`} onPress={confirmMapPoint} loading={loading} />
          <Button title="Back to search" variant="outline" onPress={() => setMode('search')} style={{ backgroundColor: '#fff' }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 16, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>←</Text>
        </Pressable>
        <Text style={styles.h2}>{title}</Text>
      </View>
      <Input placeholder="Search area, street, landmark" value={q} onChangeText={setQ} autoFocus />
      <Pressable onPress={() => setMode('map')} style={{ paddingVertical: 12 }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>📍 Choose on map</Text>
      </Pressable>
      {loading ? <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} /> : null}
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={results}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(p, i) => `${p.lat},${p.lng},${i}`}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <Text style={{ fontSize: 15, color: colors.text }} numberOfLines={2}>
              {item.address}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
