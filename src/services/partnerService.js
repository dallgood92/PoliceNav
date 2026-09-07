// Replace this in-memory adapter with a WebSocket-backed implementation later.
export async function getPartners() {
  const now = Date.now();
  return [
    {
      id: 'johnson',
      name: 'Johnson',
      unit: 'Unit 214',
      connection: { online: true, quality: 'good', lastSeenAt: now - 12000 },
      location: { latitude: 33.2148, longitude: -97.1321 },
    },
    {
      id: 'ramirez',
      name: 'Ramirez',
      unit: 'Unit 307',
      connection: { online: true, quality: 'weak', lastSeenAt: now - 28000 },
      location: { latitude: 33.2087, longitude: -97.1432 },
    },
    {
      id: 'smith',
      name: 'Smith',
      unit: 'Unit 119',
      connection: { online: false, quality: 'offline', lastSeenAt: now - 240000 },
      location: { latitude: 33.2262, longitude: -97.1198 },
    },
  ];
}

export function subscribeToPartners(onPartners) {
  getPartners().then(onPartners);
  return () => {};
}
