import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { upsertOfficer } from '../services/departmentService';

WebBrowser.maybeCompleteAuthSession();
const SESSION_KEY = '@blockwatch/officer-session';

export function useOfficerSession() {
  const [officer, setOfficer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const configured = Boolean(iosClientId || androidClientId || webClientId);
  const placeholderClientId = 'demo-disabled.apps.googleusercontent.com';
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: iosClientId || placeholderClientId,
    androidClientId: androidClientId || placeholderClientId,
    webClientId: webClientId || placeholderClientId,
  });

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then(async (saved) => {
        if (!saved) return;
        const profile = JSON.parse(saved);
        if (profile.id === 'demo-admin' && profile.name !== 'Dylan Allgood') {
          const updated = (await upsertOfficer({ ...profile, name: 'Dylan Allgood', email: 'dylan@blockwatch.local' })).user;
          await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updated));
          setOfficer(updated);
        } else setOfficer(profile);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (response?.type !== 'success' || !response.authentication?.accessToken) return;
    setLoading(true);
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${response.authentication.accessToken}` },
    })
      .then((result) => result.json())
      .then((profile) => signInProfile({ id: profile.sub, email: profile.email, name: profile.name, picture: profile.picture }))
      .catch(() => setError('Google sign-in could not be completed.'))
      .finally(() => setLoading(false));
  }, [response]);

  const signInProfile = async (profile) => {
    const result = await upsertOfficer(profile);
    setOfficer(result.user);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
  };

  const signIn = async () => {
    setError(null);
    if (!configured) return signInProfile({ id: 'demo-admin', email: 'dylan@blockwatch.local', name: 'Dylan Allgood' });
    await promptAsync();
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setOfficer(null);
  };

  return { officer, loading, error, configured, request, signIn, signOut };
}
