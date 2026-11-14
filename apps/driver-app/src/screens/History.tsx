import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STATUS_LABELS, type OrderView } from '@porter/shared';
import { api } from '../lib/session';
import { Button, Card, ErrorText, colors, styles } from '../ui';

export function HistoryScreen({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ orders: OrderView[] }>('/driver/orders')
      .then((r) => setOrders(r.orders))
      .catch((e) => setError((e as Error).message));
  }, []);

  const earned = (orders ?? []).filter((o) => o.status === 'completed').reduce((sum, o) => sum + o.fare, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>←</Text>
        </Pressable>
        <Text style={styles.h2}>Trip history</Text>
      </View>
      {!orders && !error ? <ActivityIndicator color={colors.primary} /> : null}
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={orders ?? []}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={
          orders ? (
            <Text style={[styles.muted, { marginBottom: 4 }]}>
              Total earned (last {orders.length} trips): <Text style={{ fontWeight: '800', color: colors.text }}>₹{earned}</Text>
            </Text>
          ) : undefined
        }
        ListEmptyComponent={orders ? <Text style={styles.muted}>No trips yet.</Text> : undefined}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{STATUS_LABELS[item.status]}</Text>
              <Text style={{ fontWeight: '800', color: colors.text }}>₹{item.fare}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.muted, { marginTop: 6 }]}>From: {item.pickup.address}</Text>
            <Text numberOfLines={1} style={styles.muted}>To: {item.drop.address}</Text>
            <Text style={[styles.muted, { marginTop: 6, fontSize: 12 }]}>{new Date(item.createdAt).toLocaleString()}</Text>
          </Card>
        )}
        ListFooterComponent={<Button title="Log out" variant="outline" onPress={onLogout} style={{ marginTop: 24 }} />}
      />
    </View>
  );
}
