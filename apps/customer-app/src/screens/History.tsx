import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STATUS_LABELS, getVehicleType, type OrderView, type UserView } from '@porter/shared';
import { api } from '../lib/session';
import { Button, Card, ErrorText, colors, styles } from '../ui';

export function HistoryScreen({
  user,
  onBack,
  onOpen,
  onLogout,
}: {
  user: UserView;
  onBack: () => void;
  onOpen: (order: OrderView) => void;
  onLogout: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ orders: OrderView[] }>('/orders')
      .then((r) => setOrders(r.orders))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>←</Text>
        </Pressable>
        <Text style={styles.h2}>My orders</Text>
      </View>
      {!orders && !error ? <ActivityIndicator color={colors.primary} /> : null}
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={orders ?? []}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={orders ? <Text style={styles.muted}>No orders yet.</Text> : undefined}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item)}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {getVehicleType(item.vehicleType)?.icon} {STATUS_LABELS[item.status]}
                </Text>
                <Text style={{ fontWeight: '800', color: colors.text }}>₹{item.fare}</Text>
              </View>
              <Text numberOfLines={1} style={[styles.muted, { marginTop: 6 }]}>From: {item.pickup.address}</Text>
              <Text numberOfLines={1} style={styles.muted}>To: {item.drop.address}</Text>
              <Text style={[styles.muted, { marginTop: 6, fontSize: 12 }]}>{new Date(item.createdAt).toLocaleString()}</Text>
            </Card>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.muted, { textAlign: 'center', marginBottom: 8 }]}>
              Logged in as {user.name} (+91 {user.phone})
            </Text>
            <Button title="Log out" variant="outline" onPress={onLogout} />
          </View>
        }
      />
    </View>
  );
}
