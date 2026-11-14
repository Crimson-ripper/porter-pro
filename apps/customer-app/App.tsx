import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { OrderView, UserView } from '@porter/shared';
import { API_URL, api, clearSession, loadToken } from './src/lib/session';
import { HistoryScreen } from './src/screens/History';
import { HomeScreen } from './src/screens/Home';
import { LoginScreen, NameScreen } from './src/screens/Login';
import { TrackingScreen } from './src/screens/Tracking';
import { Button, colors, styles } from './src/ui';

type Screen = { name: 'home' } | { name: 'history' } | { name: 'tracking'; order: OrderView };

export default function App() {
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [user, setUser] = useState<UserView | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  async function boot() {
    setBooting(true);
    setBootError('');
    try {
      if (await loadToken()) {
        const me = await api.get<{ user: UserView }>('/me');
        setUser(me.user);
        // Resume a booking that is still in progress.
        const { order } = await api.get<{ order: OrderView | null }>('/orders/active');
        if (order) setScreen({ name: 'tracking', order });
      }
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
    await clearSession();
    setUser(null);
    setScreen({ name: 'home' });
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
    content = <LoginScreen onLoggedIn={setUser} />;
  } else if (!user.name) {
    content = <NameScreen onDone={setUser} />;
  } else if (screen.name === 'tracking') {
    content = <TrackingScreen key={screen.order.id} initial={screen.order} onClose={() => setScreen({ name: 'home' })} />;
  } else if (screen.name === 'history') {
    content = (
      <HistoryScreen
        user={user}
        onBack={() => setScreen({ name: 'home' })}
        onOpen={(order) => setScreen({ name: 'tracking', order })}
        onLogout={logout}
      />
    );
  } else {
    content = (
      <HomeScreen
        user={user}
        onBooked={(order) => setScreen({ name: 'tracking', order })}
        onOpenHistory={() => setScreen({ name: 'history' })}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>{content}</View>
    </SafeAreaProvider>
  );
}
