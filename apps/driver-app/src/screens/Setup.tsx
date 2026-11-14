import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VEHICLE_TYPES, type DriverProfile, type UserView, type VehicleTypeId } from '@porter/shared';
import { api } from '../lib/session';
import { Button, ErrorText, Input, colors, styles } from '../ui';

// Driver details and vehicle. Document upload / KYC comes after the PoC.
export function SetupScreen({
  user,
  profile,
  onDone,
}: {
  user: UserView;
  profile: DriverProfile | null;
  onDone: (profile: DriverProfile, name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user.name);
  const [vehicleType, setVehicleType] = useState<VehicleTypeId>(profile?.vehicleType ?? 'bike');
  const [vehicleNumber, setVehicleNumber] = useState(profile?.vehicleNumber ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError('');
    try {
      const res = await api.put<{ driver: DriverProfile }>('/driver/profile', { name, vehicleType, vehicleNumber });
      onDone(res.driver, name.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24 }} keyboardShouldPersistTaps="handled">
      <Text style={[styles.h1, { marginBottom: 6 }]}>Your details</Text>
      <Text style={[styles.muted, { marginBottom: 24 }]}>Tell us about you and your vehicle.</Text>
      <Input label="Full name" value={name} onChangeText={setName} placeholder="As on driving licence" />
      <Text style={styles.label}>Vehicle type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        {VEHICLE_TYPES.map((v) => {
          const selected = v.id === vehicleType;
          return (
            <Pressable
              key={v.id}
              onPress={() => setVehicleType(v.id)}
              style={{
                width: '47%',
                padding: 12,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? '#EFF6FF' : '#fff',
              }}
            >
              <Text style={{ fontSize: 28 }}>{v.icon}</Text>
              <Text style={{ fontWeight: '700', color: colors.text }}>{v.name}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>{v.capacity}</Text>
            </Pressable>
          );
        })}
      </View>
      <Input
        label="Vehicle number"
        value={vehicleNumber}
        onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
        placeholder="e.g. MH12AB1234"
        autoCapitalize="characters"
      />
      <Button title="Save & continue" onPress={save} loading={loading} disabled={name.trim().length < 2 || vehicleNumber.length < 6} />
      <ErrorText>{error}</ErrorText>
    </ScrollView>
  );
}
