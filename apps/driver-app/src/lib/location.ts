import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { EVENTS, type LatLng } from '@porter/shared';
import { getSocket } from './session';

// Watches the phone's GPS while `active` and streams it to the server.
//
// PoC limitation: this runs only while the app is open (Expo Go cannot track
// in the background). The screen is kept awake while online. A production
// build adds a background location task with an Android foreground service.
export function useLiveLocation(active: boolean) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to receive trips.');
        return;
      }
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (cancelled) return;
      setPosition({ lat: first.coords.latitude, lng: first.coords.longitude });
      if (!active) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
        (loc) => {
          const p = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setPosition(p);
          getSocket().emit(EVENTS.location, p);
        },
      );
      if (cancelled) sub.remove();
    })().catch((e) => setError((e as Error).message));

    // Re-send periodically so the server knows we are still here even when standing still.
    const heartbeat = setInterval(() => {
      if (!active) return;
      setPosition((p) => {
        if (p) getSocket().emit(EVENTS.location, p);
        return p;
      });
    }, 30_000);

    return () => {
      cancelled = true;
      sub?.remove();
      clearInterval(heartbeat);
    };
  }, [active]);

  return { position, error };
}
