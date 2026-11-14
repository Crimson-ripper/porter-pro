import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VEHICLE_TYPES, type OrderView, type Place, type UserView, type VehicleTypeId } from '@porter/shared';
import { api } from '../lib/session';
import { Button, Card, Dot, ErrorText, colors, styles } from '../ui';
import { PlaceSearchScreen } from './PlaceSearch';

interface Estimate {
  distanceKm: number;
  options: { vehicleType: VehicleTypeId; fare: number }[];
}

export function HomeScreen({
  user,
  onBooked,
  onOpenHistory,
}: {
  user: UserView;
  onBooked: (order: OrderView) => void;
  onOpenHistory: () => void;
}) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [pickup, setPickup] = useState<Place | null>(null);
  const [drop, setDrop] = useState<Place | null>(null);
  const [editing, setEditing] = useState<'pickup' | 'drop' | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [vehicle, setVehicle] = useState<VehicleTypeId>('bike');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Default pickup = current location.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setError('Allow location to set your pickup automatically.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const res = await api.get<{ place: Place }>(`/geo/reverse?lat=${here.lat}&lng=${here.lng}`);
        setPickup((p) => p ?? res.place);
      } catch {
        setPickup((p) => p ?? { ...here, address: 'Current location' });
      }
    })().catch((e) => setError((e as Error).message));
  }, []);

  // Fares for every vehicle once both points are set.
  useEffect(() => {
    setEstimate(null);
    if (!pickup || !drop) return;
    api
      .post<Estimate>('/fare/estimate', { pickup, drop })
      .then(setEstimate)
      .catch((e) => setError((e as Error).message));
    const coords = [pickup, drop].map((p) => ({ latitude: p.lat, longitude: p.lng }));
    map.current?.fitToCoordinates(coords, { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true });
  }, [pickup, drop]);

  useEffect(() => {
    if (pickup && !drop) {
      map.current?.animateToRegion({ latitude: pickup.lat, longitude: pickup.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 });
    }
  }, [pickup]);

  async function book() {
    if (!pickup || !drop) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ order: OrderView }>('/orders', { pickup, drop, vehicleType: vehicle });
      onBooked(res.order);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <PlaceSearchScreen
        title={editing === 'pickup' ? 'Pickup location' : 'Drop location'}
        near={pickup}
        onBack={() => setEditing(null)}
        onSelect={(p) => {
          if (editing === 'pickup') setPickup(p);
          else setDrop(p);
          setEditing(null);
        }}
      />
    );
  }

  const fare = estimate?.options.find((o) => o.vehicleType === vehicle)?.fare;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        showsUserLocation
        initialRegion={{ latitude: 28.6315, longitude: 77.2167, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {pickup ? <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} pinColor="green" title="Pickup" /> : null}
        {drop ? <Marker coordinate={{ latitude: drop.lat, longitude: drop.lng }} pinColor="red" title="Drop" /> : null}
        {pickup && drop ? (
          <Polyline
            coordinates={[pickup, drop].map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 6]}
          />
        ) : null}
      </MapView>

      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Card style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>Hi {user.name.split(' ')[0]} 👋</Text>
        </Card>
        <Pressable onPress={onOpenHistory}>
          <Card style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
            <Text style={{ fontWeight: '700', color: colors.primary }}>My orders</Text>
          </Card>
        </Pressable>
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: insets.bottom + 16 }}>
          <Pressable onPress={() => setEditing('pickup')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <Dot color={colors.pickup} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: pickup ? colors.text : colors.muted }}>
              {pickup?.address ?? 'Pickup location'}
            </Text>
          </Pressable>
          <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 20 }} />
          <Pressable onPress={() => setEditing('drop')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <Dot color={colors.drop} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: drop ? colors.text : colors.muted }}>
              {drop?.address ?? 'Where should it go?'}
            </Text>
          </Pressable>

          {estimate ? (
            <>
              <Text style={[styles.muted, { marginTop: 8, marginBottom: 8 }]}>{estimate.distanceKm} km · Pay by cash</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {VEHICLE_TYPES.map((v) => {
                  const selected = v.id === vehicle;
                  const f = estimate.options.find((o) => o.vehicleType === v.id)?.fare;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setVehicle(v.id)}
                      style={{
                        width: 112,
                        padding: 10,
                        marginRight: 10,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? '#EFF6FF' : '#fff',
                      }}
                    >
                      <Text style={{ fontSize: 28 }}>{v.icon}</Text>
                      <Text style={{ fontWeight: '700', color: colors.text }}>{v.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>{v.capacity}</Text>
                      <Text style={{ fontWeight: '800', marginTop: 4, color: colors.text }}>₹{f}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Button
                title={`Book ${VEHICLE_TYPES.find((v) => v.id === vehicle)?.name} · ₹${fare ?? ''}`}
                onPress={book}
                loading={loading}
              />
            </>
          ) : null}
          <ErrorText>{error}</ErrorText>
        </Card>
      </View>
    </View>
  );
}
