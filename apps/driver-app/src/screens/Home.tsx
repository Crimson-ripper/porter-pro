import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Switch, Text, Vibration, View } from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EVENTS, getVehicleType, type DriverProfile, type JobOffer, type LatLng, type OrderView, type UserView } from '@porter/shared';
import { api, getSocket } from '../lib/session';
import { Button, Card, Dot, ErrorText, colors, styles } from '../ui';

export function HomeScreen({
  user,
  profile,
  position,
  onProfile,
  onTrip,
  onOpenHistory,
  onEditProfile,
}: {
  user: UserView;
  profile: DriverProfile;
  position: LatLng | null;
  onProfile: (p: DriverProfile) => void;
  onTrip: (order: OrderView) => void;
  onOpenHistory: () => void;
  onEditProfile: () => void;
}) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [toggling, setToggling] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (position) {
      map.current?.animateToRegion({ latitude: position.lat, longitude: position.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 });
    }
  }, [!!position]);

  useEffect(() => {
    const socket = getSocket();
    const onOffer = (o: JobOffer) => {
      setOffer(o);
      setSecondsLeft(o.expiresInSec);
      Vibration.vibrate([0, 600, 300, 600, 300, 600]);
    };
    const onCancelled = ({ orderId }: { orderId: string }) => setOffer((o) => (o?.order.id === orderId ? null : o));
    socket.on(EVENTS.offer, onOffer);
    socket.on(EVENTS.offerCancelled, onCancelled);
    return () => {
      socket.off(EVENTS.offer, onOffer);
      socket.off(EVENTS.offerCancelled, onCancelled);
    };
  }, []);

  useEffect(() => {
    if (!offer) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [offer]);

  useEffect(() => {
    if (offer && secondsLeft === 0) setOffer(null);
  }, [secondsLeft]);

  async function toggleOnline(online: boolean) {
    setToggling(true);
    setError('');
    try {
      const res = await api.post<{ driver: DriverProfile }>('/driver/online', { online, ...(position ?? {}) });
      onProfile(res.driver);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setToggling(false);
    }
  }

  async function accept() {
    if (!offer) return;
    setAccepting(true);
    try {
      const res = await api.post<{ order: OrderView }>(`/driver/orders/${offer.order.id}/accept`);
      setOffer(null);
      onTrip(res.order);
    } catch (e) {
      setOffer(null);
      setError((e as Error).message);
    } finally {
      setAccepting(false);
    }
  }

  function reject() {
    if (!offer) return;
    void api.post(`/driver/orders/${offer.order.id}/reject`).catch(() => {});
    setOffer(null);
  }

  const vehicle = getVehicleType(profile.vehicleType ?? '');

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        showsUserLocation
        initialRegion={{ latitude: 28.6315, longitude: 77.2167, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      />

      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: profile.online ? colors.green : colors.muted }}>
              {profile.online ? 'You are online' : 'You are offline'}
            </Text>
            <Text style={styles.muted}>{profile.online ? 'Waiting for trips nearby' : 'Go online to receive trips'}</Text>
          </View>
          <Switch
            value={profile.online}
            disabled={toggling}
            onValueChange={toggleOnline}
            trackColor={{ true: colors.green, false: colors.border }}
          />
        </Card>
        <ErrorText>{error}</ErrorText>
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: insets.bottom + 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.muted}>Today</Text>
              <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>₹{profile.todayEarnings}</Text>
              <Text style={styles.muted}>{profile.todayTrips} trips</Text>
            </View>
            <Pressable onPress={onEditProfile} style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {vehicle?.icon} {user.name}
              </Text>
              <Text style={styles.muted}>{profile.vehicleNumber}</Text>
            </Pressable>
          </View>
          <Button title="Trip history" variant="outline" onPress={onOpenHistory} style={{ marginTop: 14 }} />
        </Card>
      </View>

      <Modal visible={!!offer} transparent animationType="slide" onRequestClose={reject}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {offer ? (
            <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: insets.bottom + 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.h2}>New trip request</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.red }}>{secondsLeft}s</Text>
              </View>
              <Text style={{ fontSize: 34, fontWeight: '800', color: colors.green, marginVertical: 8 }}>₹{offer.order.fare}</Text>
              <Text style={[styles.muted, { marginBottom: 12 }]}>{offer.order.distanceKm} km trip · Cash</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Dot color={colors.pickup} />
                <Text numberOfLines={2} style={{ flex: 1, color: colors.text }}>{offer.order.pickup.address}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                <Dot color={colors.drop} />
                <Text numberOfLines={2} style={{ flex: 1, color: colors.text }}>{offer.order.drop.address}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button title="Reject" variant="outline" onPress={reject} style={{ flex: 1 }} />
                <Button title="Accept" onPress={accept} loading={accepting} style={{ flex: 2, backgroundColor: colors.green }} />
              </View>
            </Card>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
