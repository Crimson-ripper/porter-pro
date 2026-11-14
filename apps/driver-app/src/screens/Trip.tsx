import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EVENTS, type LatLng, type OrderView } from '@porter/shared';
import { api, getSocket } from '../lib/session';
import { Button, Card, Dot, ErrorText, Input, colors, styles } from '../ui';

function openNavigation(to: LatLng) {
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${to.lat},${to.lng}`
      : `google.navigation:q=${to.lat},${to.lng}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}`),
  );
}

export function TripScreen({ initial, position, onDone }: { initial: OrderView; position: LatLng | null; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [order, setOrder] = useState(initial);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (o: OrderView) => {
      if (o.id === initial.id) setOrder(o);
    };
    socket.on(EVENTS.orderUpdate, onUpdate);
    return () => {
      socket.off(EVENTS.orderUpdate, onUpdate);
    };
  }, [initial.id]);

  useEffect(() => {
    const target = order.status === 'in_transit' ? order.drop : order.pickup;
    const points = [target, ...(position ? [position] : [])];
    map.current?.fitToCoordinates(
      points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 80, right: 60, bottom: 360, left: 60 }, animated: true },
    );
  }, [order.status, !!position]);

  async function act(path: string, body: unknown = {}) {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ order: OrderView }>(`/driver/orders/${order.id}/${path}`, body);
      setOrder(res.order);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function cancelTrip() {
    Alert.alert('Cancel this trip?', 'Frequent cancellations can lower your rating.', [
      { text: 'No' },
      { text: 'Yes, cancel', style: 'destructive', onPress: () => void act('cancel') },
    ]);
  }

  const target = order.status === 'in_transit' ? order.drop : order.pickup;

  if (order.status === 'completed' || order.status === 'cancelled') {
    const done = order.status === 'completed';
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 56, textAlign: 'center' }}>{done ? '✅' : '❌'}</Text>
        <Text style={[styles.h1, { textAlign: 'center', marginVertical: 12 }]}>{done ? 'Trip completed' : 'Trip cancelled'}</Text>
        {done ? (
          <Text style={[styles.muted, { textAlign: 'center', fontSize: 16, marginBottom: 24 }]}>
            Collect <Text style={{ fontWeight: '800', color: colors.text }}>₹{order.fare}</Text> in cash from the customer.
          </Text>
        ) : (
          <Text style={[styles.muted, { textAlign: 'center', marginBottom: 24 }]}>{order.cancelReason}</Text>
        )}
        <Button title="Back to home" onPress={onDone} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        showsUserLocation
        initialRegion={{ latitude: target.lat, longitude: target.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
      >
        <Marker
          coordinate={{ latitude: target.lat, longitude: target.lng }}
          pinColor={order.status === 'in_transit' ? 'red' : 'green'}
          title={order.status === 'in_transit' ? 'Drop' : 'Pickup'}
        />
      </MapView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: insets.bottom + 16 }}>
          <Text style={styles.h2}>
            {order.status === 'assigned' ? 'Go to pickup' : order.status === 'arrived' ? 'At pickup' : 'Deliver to drop'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Dot color={order.status === 'in_transit' ? colors.drop : colors.pickup} />
            <Text numberOfLines={2} style={{ flex: 1, color: colors.text }}>{target.address}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <View>
              <Text style={{ fontWeight: '700', color: colors.text }}>{order.customer?.name || 'Customer'}</Text>
              <Text style={styles.muted}>₹{order.fare} · {order.distanceKm} km · Cash</Text>
            </View>
            <Button
              title="📞 Call"
              variant="outline"
              onPress={() => Linking.openURL(`tel:${order.customer?.phone}`)}
              style={{ height: 42 }}
            />
          </View>

          <View style={{ marginTop: 14, gap: 10 }}>
            {order.status !== 'arrived' ? (
              <Button title="🧭 Navigate" variant="outline" onPress={() => openNavigation(target)} />
            ) : null}
            {order.status === 'assigned' ? <Button title="I have arrived at pickup" onPress={() => act('arrived')} loading={busy} /> : null}
            {order.status === 'arrived' ? (
              <>
                <Input
                  label="Pickup OTP from customer"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="4-digit OTP"
                />
                <Button title="Start trip" onPress={() => act('start', { otp })} loading={busy} disabled={otp.length !== 4} />
              </>
            ) : null}
            {order.status === 'in_transit' ? (
              <Button
                title={`Complete delivery · Collect ₹${order.fare}`}
                onPress={() => act('complete')}
                loading={busy}
                style={{ backgroundColor: colors.green }}
              />
            ) : null}
            {order.status === 'assigned' || order.status === 'arrived' ? (
              <Button title="Cancel trip" variant="outline" onPress={cancelTrip} style={{ borderColor: colors.red }} />
            ) : null}
          </View>
          <ErrorText>{error}</ErrorText>
        </Card>
      </View>
    </View>
  );
}
