import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { DriverProfile, OrderView, UserView } from '@porter/shared';
import { useLiveLocation } from './src/lib/location';
import { API_URL, api, clearSession, loadToken } from './src/lib/session';
import { HistoryScreen } from './src/screens/History';
import { HomeScreen } from './src/screens/Home';
import { LoginScreen } from './src/screens/Login';
import { SetupScreen } from './src/screens/Setup';
import { TripScreen } from './src/screens/Trip';
import { Button, colors, styles } from './src/ui';

type Screen = { name: 'home' } | { name: 'history' } | { name: 'setup' } | { name: 'trip'; order: OrderView };

function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [user, setUser] = useState<UserView | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  const working = !!user && ((profile?.online ?? false) || screen.name === 'trip');
  const { position, error: locationError } = useLiveLocation(working);

  async function loadMe() {
    const me = await api.get<{ user: UserView; driver: DriverProfile }>('/me');
    setUser(me.user);
    setProfile(me.driver);
    const { order } = await api.get<{ order: OrderView | null }>('/driver/active-order');
    if (order) setScreen({ name: 'trip', order });
  }

  async function boot() {
    setBooting(true);
    setBootError('');
    try {
      if (await loadToken()) await loadMe();
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401) await clearSession();
      else setBootError(err.message);
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  async function logout() {
    await api.post('/driver/online', { online: false }).catch(() => {});
    await clearSession();
    setUser(null);
    setProfile(null);
    setScreen({ name: 'home' });
  }

  async function backHome() {
    setScreen({ name: 'home' });
    const res = await api.get<{ driver: DriverProfile }>('/driver/profile').catch(() => null);
    if (res) setProfile(res.driver);
  }

  let content;
  if (booting) {
    content = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  } else if (bootError) {
    content = (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={[styles.h2, { marginBottom: 8 }]}>Can't connect</Text>
        <Text style={[styles.muted, { marginBottom: 20 }]}>
          {bootError}
          {'\n\n'}API: {API_URL}
        </Text>
        <Button title="Try again" onPress={boot} />
      </View>
    );
  } else if (!user) {
    content = <LoginScreen onLoggedIn={() => void loadMe().catch((e) => setBootError((e as Error).message))} />;
  } else if (!profile?.vehicleType || screen.name === 'setup') {
    content = (
      <SetupScreen
        user={user}
        profile={profile}
        onDone={(p, name) => {
          setProfile(p);
          setUser({ ...user, name });
          setScreen({ name: 'home' });
        }}
      />
    );
  } else if (screen.name === 'trip') {
    content = <TripScreen key={screen.order.id} initial={screen.order} position={position} onDone={backHome} />;
  } else if (screen.name === 'history') {
    content = <HistoryScreen onBack={() => setScreen({ name: 'home' })} onLogout={logout} />;
  } else {
    content = (
      <HomeScreen
        user={user}
        profile={profile}
        position={position}
        onProfile={setProfile}
        onTrip={(order) => setScreen({ name: 'trip', order })}
        onOpenHistory={() => setScreen({ name: 'history' })}
        onEditProfile={() => setScreen({ name: 'setup' })}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {working ? <KeepAwake /> : null}
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {content}
        {locationError ? (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.red, padding: 10 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{locationError}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}
