import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EVENTS, STATUS_LABELS, getVehicleType, type LatLng, type OrderView } from '@porter/shared';
import { api, getSocket } from '../lib/session';
import { Button, Card, Dot, ErrorText, colors, styles } from '../ui';

export function TrackingScreen({ initial, onClose }: { initial: OrderView; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [order, setOrder] = useState(initial);
  const [driverPos, setDriverPos] = useState<LatLng | null>(
    initial.driver?.lat != null && initial.driver.lng != null ? { lat: initial.driver.lat, lng: initial.driver.lng } : null,
  );
  const [rating, setRating] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Live updates over the socket, plus a fetch on (re)connect in case we missed any.
  useEffect(() => {
    const socket = getSocket();
    const refresh = () =>
      api
        .get<{ order: OrderView }>(`/orders/${initial.id}`)
        .then((r) => setOrder(r.order))
        .catch(() => {});
    const onUpdate = (o: OrderView) => {
      if (o.id !== initial.id) return;
      setOrder(o);
      if (o.driver?.lat != null && o.driver.lng != null) setDriverPos({ lat: o.driver.lat, lng: o.driver.lng });
    };
    const onLocation = (p: { orderId: string; lat: number; lng: number }) => {
      if (p.orderId === initial.id) setDriverPos({ lat: p.lat, lng: p.lng });
    };
    socket.on(EVENTS.orderUpdate, onUpdate);
    socket.on(EVENTS.driverLocation, onLocation);
    socket.on('connect', refresh);
    void refresh();
    return () => {
      socket.off(EVENTS.orderUpdate, onUpdate);
      socket.off(EVENTS.driverLocation, onLocation);
      socket.off('connect', refresh);
    };
  }, [initial.id]);

  useEffect(() => {
    const points = [order.pickup, order.drop, ...(driverPos ? [driverPos] : [])];
    map.current?.fitToCoordinates(
      points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 100, right: 60, bottom: 380, left: 60 }, animated: true },
    );
  }, [order.status, !!driverPos]);

  function cancel() {
    Alert.alert('Cancel booking?', 'Are you sure you want to cancel this booking?', [
      { text: 'No' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const res = await api.post<{ order: OrderView }>(`/orders/${order.id}/cancel`, {});
            setOrder(res.order);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function rate(stars: number) {
    setRating(stars);
    await api.post(`/orders/${order.id}/rate`, { rating: stars }).catch(() => {});
  }

  const vehicle = getVehicleType(order.vehicleType);
  const finished = ['completed', 'cancelled', 'no_driver'].includes(order.status);
  const canCancel = ['searching', 'assigned', 'arrived'].includes(order.status);

  return (
    <View style={{ flex: 1 }}>
      <MapView ref={map} style={{ flex: 1 }} initialRegion={{ latitude: order.pickup.lat, longitude: order.pickup.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }}>
        <Marker coordinate={{ latitude: order.pickup.lat, longitude: order.pickup.lng }} pinColor="green" title="Pickup" />
        <Marker coordinate={{ latitude: order.drop.lat, longitude: order.drop.lng }} pinColor="red" title="Drop" />
        {driverPos && !finished ? (
          <Marker coordinate={{ latitude: driverPos.lat, longitude: driverPos.lng }} title="Driver">
            <Text style={{ fontSize: 30 }}>{vehicle?.icon}</Text>
          </Marker>
        ) : null}
      </MapView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: insets.bottom + 16 }}>
          <Text style={styles.h2}>{STATUS_LABELS[order.status]}</Text>
          {order.status === 'searching' ? (
            <Text style={[styles.muted, { marginTop: 4 }]}>Looking for a {vehicle?.name} near your pickup…</Text>
          ) : null}
          {order.status === 'no_driver' ? (
            <Text style={[styles.muted, { marginTop: 4 }]}>All drivers are busy right now. Please try again in a few minutes.</Text>
          ) : null}

          {order.driver && !finished ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{order.driver.name}</Text>
                <Text style={styles.muted}>
                  {vehicle?.name} · {order.driver.vehicleNumber}
                </Text>
              </View>
              <Button title="📞 Call" variant="outline" onPress={() => Linking.openURL(`tel:${order.driver!.phone}`)} style={{ height: 42 }} />
            </View>
          ) : null}

          {['assigned', 'arrived'].includes(order.status) ? (
            <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#EFF6FF' }}>
              <Text style={styles.muted}>Share this OTP with the driver at pickup</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', letterSpacing: 8, color: colors.primary }}>{order.pickupOtp}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Dot color={colors.pickup} />
              <Text numberOfLines={1} style={{ flex: 1, color: colors.text }}>{order.pickup.address}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Dot color={colors.drop} />
              <Text numberOfLines={1} style={{ flex: 1, color: colors.text }}>{order.drop.address}</Text>
            </View>
          </View>
          <Text style={{ marginTop: 10, fontWeight: '700', color: colors.text }}>
            ₹{order.fare} · {order.distanceKm} km · Cash
          </Text>

          {order.status === 'completed' ? (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.muted}>Rate your driver</Text>
              <View style={{ flexDirection: 'row', marginVertical: 8 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Pressable key={s} onPress={() => rate(s)} hitSlop={6}>
                    <Text style={{ fontSize: 34, marginRight: 6, color: s <= rating ? '#F59E0B' : colors.border }}>★</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <ErrorText>{error}</ErrorText>
          <View style={{ marginTop: 14 }}>
            {canCancel ? <Button title="Cancel booking" variant="outline" onPress={cancel} loading={busy} /> : null}
            {finished ? <Button title={order.status === 'completed' ? 'Done' : 'Back to home'} onPress={onClose} /> : null}
          </View>
        </Card>
      </View>
    </View>
  );
}
