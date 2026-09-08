import { websocketUrl } from './locationApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UNIT_OVERRIDES_KEY = '@blockwatch/demo-unit-overrides';

export async function getPartners() {
  const now = Date.now();
  const partners = [
    {
      id: 'demo-jeremy-rogers',
      mock: true,
      name: 'Jeremy Rogers', unit: 'Unit 47', callSign: '861', avatarColor: '#2563EB', dutyStatus: 'traffic_stop',
      occupants: ['Jeremy Rogers', 'Dylan Allgood'],
      connection: { online: true, quality: 'good', lastSeenAt: now - 12000 },
      location: { latitude: 33.1218, longitude: -97.1819, timestamp: now - 12000 },
    },
    {
      id: 'demo-trey-humphries',
      mock: true,
      name: 'Trey Humphries', unit: 'Unit 46', callSign: '874', avatarColor: '#7C3AED', dutyStatus: 'cover_requested',
      occupants: ['Trey Humphries'],
      connection: { online: true, quality: 'good', lastSeenAt: now - 8000 },
      location: { latitude: 33.1261, longitude: -97.1882, timestamp: now - 8000 },
    },
    {
      id: 'demo-jared-ramm',
      mock: true,
      name: 'Jared Ramm', unit: 'Unit 49', callSign: '869', avatarColor: '#D97706', dutyStatus: 'available',
      occupants: ['Jared Ramm'],
      connection: { online: true, quality: 'good', lastSeenAt: now - 18000 },
      location: { latitude: 33.1164, longitude: -97.1904, timestamp: now - 18000 },
    },
  ];
  try {
    const overrides = JSON.parse(await AsyncStorage.getItem(UNIT_OVERRIDES_KEY)) || {};
    return partners.map((partner) => ({ ...partner, ...overrides[partner.id] }));
  } catch { return partners; }
}

export async function savePartnerUnitOverride(partner) {
  if (!partner.mock) return;
  let overrides = {};
  try { overrides = JSON.parse(await AsyncStorage.getItem(UNIT_OVERRIDES_KEY)) || {}; } catch {}
  overrides[partner.id] = { unit: partner.unit, callSign: partner.callSign, occupants: partner.occupants };
  await AsyncStorage.setItem(UNIT_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function subscribeToPartners(onPartners) {
  const url = websocketUrl();
  if (!url) {
    getPartners().then(onPartners);
    return () => {};
  }

  let disposed = false;
  let socket;
  let retryTimer;
  let partners = [];
  let demos = [];
  getPartners().then((items) => { demos = items; onPartners([...partners, ...demos]); });

  const upsert = (partner) => {
    partners = [...partners.filter((item) => item.id !== partner.id), partner]
      .sort((a, b) => a.name.localeCompare(b.name));
    onPartners([...partners, ...demos]);
  };

  const connect = () => {
    if (disposed) return;
    socket = new WebSocket(url);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'snapshot') {
          partners = message.partners;
          onPartners([...partners, ...demos]);
        } else if (message.type === 'partner:update') {
          upsert(message.partner);
        }
      } catch {
        // Ignore malformed server messages and retain the last good snapshot.
      }
    };
    socket.onclose = () => {
      if (!disposed) retryTimer = setTimeout(connect, 2000);
    };
    socket.onerror = () => socket.close();
  };

  connect();
  return () => {
    disposed = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
