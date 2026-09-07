export function getPartnerPresence(partner, now = Date.now()) {
  const lastSeenAt = partner.connection?.lastSeenAt;
  const ageMs = Number.isFinite(lastSeenAt) ? Math.max(0, now - lastSeenAt) : Infinity;
  const heartbeatFresh = ageMs <= 45000;
  const online = Boolean(partner.connection?.online) && heartbeatFresh;

  if (!online) {
    const minutes = Number.isFinite(ageMs) ? Math.max(1, Math.round(ageMs / 60000)) : null;
    return {
      online: false,
      quality: 'offline',
      label: minutes ? `Offline · ${minutes}m ago` : 'Offline',
    };
  }

  const weak = partner.connection.quality === 'weak';
  return {
    online: true,
    quality: weak ? 'weak' : 'good',
    label: weak ? 'Online · Weak signal' : 'Online · Good signal',
  };
}
