import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import type { UserView } from '@porter/shared';
import { api, saveToken } from '../lib/session';
import { Button, ErrorText, Input, colors, styles } from '../ui';

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (user: UserView) => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const sendOtp = () =>
    run(async () => {
      const res = await api.post<{ hint: string }>('/auth/otp/send', { phone, role: 'customer' });
      setHint(res.hint);
      setStep('otp');
    });

  const verify = () =>
    run(async () => {
      const res = await api.post<{ token: string; user: UserView }>('/auth/otp/verify', {
        phone,
        otp,
        role: 'customer',
      });
      await saveToken(res.token);
      onLoggedIn(res.user);
    });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={[styles.h1, { color: colors.primary }]}>Porter Pro</Text>
      <Text style={[styles.muted, { marginBottom: 32 }]}>Move anything, anywhere in your city.</Text>

      {step === 'phone' ? (
        <View>
          <Input
            label="Mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
          />
          <Button title="Get OTP" onPress={sendOtp} loading={loading} disabled={phone.length !== 10} />
        </View>
      ) : (
        <View>
          <Text style={[styles.muted, { marginBottom: 12 }]}>
            OTP sent to +91 {phone}. {hint}
          </Text>
          <Input
            label="OTP"
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit OTP"
            value={otp}
            onChangeText={setOtp}
            autoFocus
          />
          <Button title="Verify & continue" onPress={verify} loading={loading} disabled={otp.length < 6} />
          <Button title="Change number" variant="outline" onPress={() => setStep('phone')} style={{ marginTop: 12 }} />
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </KeyboardAvoidingView>
  );
}

export function NameScreen({ onDone }: { onDone: (user: UserView) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError('');
    try {
      const res = await api.patch<{ user: UserView }>('/me', { name });
      onDone(res.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={[styles.h1, { marginBottom: 24 }]}>What's your name?</Text>
      <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoFocus />
      <Button title="Continue" onPress={save} loading={loading} disabled={name.trim().length < 2} />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
