import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_NOTIFICATIONS_KEY = '@blockwatch/push-notifications-enabled';
let cachedEnabled = true;

export async function loadPushNotificationsEnabled() {
  const saved = await AsyncStorage.getItem(PUSH_NOTIFICATIONS_KEY);
  cachedEnabled = saved !== 'false';
  return cachedEnabled;
}

export async function savePushNotificationsEnabled(enabled) {
  cachedEnabled = Boolean(enabled);
  await AsyncStorage.setItem(PUSH_NOTIFICATIONS_KEY, cachedEnabled ? 'true' : 'false');
  return cachedEnabled;
}

export function pushNotificationsEnabled() {
  return cachedEnabled;
}
