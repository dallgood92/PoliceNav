import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadDutyAssignment } from './dutyService';

const API_URL = process.env.EXPO_PUBLIC_LOCATION_API_URL?.replace(/\/$/, '');
const API_TOKEN = process.env.EXPO_PUBLIC_LOCATION_API_TOKEN;
const OFFLINE_FIX_KEY = '@blockwatch/pending-location';
const DEVICE_ID_KEY = '@blockwatch/device-id';

export async function getDeviceId() {
  const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (saved) return saved;
  const created = `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export function isLocationBackendConfigured() {
  return Boolean(API_URL && API_TOKEN);
}

export function websocketUrl() {
  if (!isLocationBackendConfigured()) return null;
  const url = new URL(API_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/partners';
  url.searchParams.set('token', API_TOKEN);
  return url.toString();
}

export async function publishLocation(location) {
  if (!isLocationBackendConfigured()) {
    throw new Error('Live sharing needs a server URL and token in the app configuration.');
  }

  const savedSession = await AsyncStorage.getItem('@blockwatch/officer-session');
  let signedInOfficer = null;
  try { signedInOfficer = savedSession ? JSON.parse(savedSession) : null; } catch {}
  if (!signedInOfficer?.name) throw new Error('Sign in before sharing your location.');
  const duty = await loadDutyAssignment();
  const payload = {
    id: await getDeviceId(),
    name: signedInOfficer.name,
    unit: `Unit ${duty.unitNumber}`,
    callSign: duty.callSign,
    avatarColor: duty.avatarColor,
    dutyStatus: duty.status,
    occupants: [signedInOfficer.name, duty.secondOfficer].filter(Boolean),
    occupantCallSigns: [duty.callSign, duty.secondOfficerCallSign].filter(Boolean),
    location: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    },
  };

  try {
    const response = await fetch(`${API_URL}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TOKEN}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Location server returned ${response.status}.`);
    await AsyncStorage.removeItem(OFFLINE_FIX_KEY);
  } catch (error) {
    await AsyncStorage.setItem(OFFLINE_FIX_KEY, JSON.stringify(payload));
    throw error;
  }
}

export async function apiRequest(path, options = {}) {
  if (!isLocationBackendConfigured()) throw new Error('Live-location server is not configured.');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || `Location server returned ${response.status}.`);
  }
  return response.json();
}

export async function registerPushToken(pushToken) {
  return apiRequest('/devices/register', {
    method: 'POST',
    body: JSON.stringify({ deviceId: await getDeviceId(), pushToken }),
  });
}

export async function createNavigationWatch(partnerId, anchorLocation, provider) {
  return apiRequest('/navigation-watches', {
    method: 'POST',
    body: JSON.stringify({
      watcherDeviceId: await getDeviceId(),
      partnerId,
      anchorLocation,
      provider,
    }),
  });
}

export async function getLatestPartner(partnerId) {
  const result = await apiRequest(`/partners/${encodeURIComponent(partnerId)}`);
  return result.partner;
}
