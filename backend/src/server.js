import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import * as store from './storage.js';

const port = Number(process.env.PORT || 8787);
const token = process.env.LOCATION_API_TOKEN;
const clients = new Set();
const OFFLINE_MS = 45_000;
const MOVE_METERS = Number(process.env.MOVEMENT_ALERT_METERS || 152.4);
const ALERT_COOLDOWN = Number(process.env.ALERT_COOLDOWN_MS || 60_000);
let sequence = 1;
if (!token || !process.env.DATABASE_URL || !process.env.REDIS_URL) throw new Error('LOCATION_API_TOKEN, DATABASE_URL, and REDIS_URL are required.');

const reply = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const authorized = (req) => req.headers.authorization === `Bearer ${token}`;
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${sequence++}`;
const publicPartner = (partner) => ({ ...partner, connection: { ...partner.connection, online: Date.now() - partner.connection.lastSeenAt <= OFFLINE_MS } });
const send = (client, body) => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(body)); };
const broadcast = (body) => clients.forEach((client) => send(client, body));
const validLocation = (value) => Number.isFinite(value?.latitude) && Math.abs(value.latitude) <= 90 && Number.isFinite(value?.longitude) && Math.abs(value.longitude) <= 180;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 16_384) reject(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function distanceMeters(a, b) {
  const rad = (degrees) => degrees * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function sendMovementAlert(watch, partner) {
  const pushToken = await store.getPushToken(watch.watcherDeviceId);
  if (!pushToken) return false;
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: pushToken, sound: 'default', channelId: 'squad-alerts', priority: 'high', title: `${partner.name} has moved`,
      body: 'Tap to refresh directions to their latest reported location.',
      data: { type: 'refresh-partner-directions', partnerId: partner.id, partnerName: partner.name, partnerUnit: partner.unit, latitude: partner.location.latitude, longitude: partner.location.longitude, provider: watch.provider },
    }),
  });
  if (!response.ok) return false;
  return (await response.json())?.data?.status !== 'error';
}

async function notifyWatches(partner) {
  const now = Date.now();
  for (const watch of await store.listNavigationWatches()) {
    if (watch.partnerId !== partner.id || now - watch.lastAlertAt < ALERT_COOLDOWN || distanceMeters(watch.anchorLocation, partner.location) < MOVE_METERS) continue;
    try {
      if (await sendMovementAlert(watch, partner)) await store.saveNavigationWatch({ ...watch, anchorLocation: partner.location, lastAlertAt: now });
    } catch { /* Retry on the next location update. */ }
  }
}

async function sendCoverAlerts(partner) {
  const tokens = await store.listPushTokensExcept(partner.id);
  if (!tokens.length) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokens.map((pushToken) => ({
      to: pushToken, sound: 'default', channelId: 'squad-alerts', priority: 'high',
      title: `COVER REQUESTED · ${partner.unit}`,
      body: `${partner.name} (Call ${partner.callSign || '—'}) is requesting cover. Tap for directions.`,
      data: { type: 'cover-request', partnerId: partner.id, partnerName: partner.name, partnerUnit: partner.unit, latitude: partner.location.latitude, longitude: partner.location.longitude, provider: 'automatic' },
    }))),
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return reply(res, 200, { ok: true, ...(await store.storageHealth()) });
    if (!authorized(req)) return res.writeHead(401).end();
    if (req.method === 'GET' && url.pathname === '/departments') return reply(res, 200, { departments: await store.listDepartments() });
    if (req.method === 'GET' && url.pathname.startsWith('/partners/')) {
      const partner = await store.getPartner(decodeURIComponent(url.pathname.slice(10)));
      return partner ? reply(res, 200, { partner: publicPartner(partner) }) : reply(res, 404, { error: 'Partner not found.' });
    }
    const workspaceMatch = url.pathname.match(/^\/users\/([^/]+)\/workspace$/);
    if (req.method === 'GET' && workspaceMatch) {
      const workspace = await store.getWorkspace(decodeURIComponent(workspaceMatch[1]));
      return workspace ? reply(res, 200, workspace) : reply(res, 404, { error: 'User not found.' });
    }

    const body = await readBody(req);
    if (req.method === 'POST' && url.pathname === '/users/upsert') {
      if (!body?.id || !body?.email || !body?.name || !body?.deviceId || !body?.callSign || !body?.unitNumber) return reply(res, 400, { error: 'Invalid user.' });
      return reply(res, 200, { user: await store.upsertUser(body) });
    }
    if (req.method === 'POST' && url.pathname === '/departments') {
      if (!body?.creatorUserId || typeof body?.name !== 'string' || body.name.trim().length < 2) return reply(res, 400, { error: 'Invalid department.' });
      const workspace = await store.createDepartment({ id: id('dept'), squadId: id('squad'), name: body.name.trim(), creatorUserId: body.creatorUserId, createdAt: Date.now() });
      return workspace ? reply(res, 201, workspace) : reply(res, 409, { error: 'User already belongs to a department.' });
    }
    const joinMatch = url.pathname.match(/^\/departments\/([^/]+)\/requests$/);
    if (req.method === 'POST' && joinMatch) {
      const request = await store.createDepartmentRequest({ id: id('request'), departmentId: joinMatch[1], userId: body?.userId, createdAt: Date.now() });
      return request ? reply(res, 201, { request }) : reply(res, 400, { error: 'Cannot request membership.' });
    }
    const approveMatch = url.pathname.match(/^\/department-requests\/([^/]+)\/approve$/);
    if (req.method === 'POST' && approveMatch) return await store.approveDepartmentRequest(approveMatch[1], body?.adminUserId) ? reply(res, 200, { approved: true }) : reply(res, 403, { error: 'Not allowed.' });
    const createSquadMatch = url.pathname.match(/^\/departments\/([^/]+)\/squads$/);
    if (req.method === 'POST' && createSquadMatch) {
      if (typeof body?.name !== 'string' || !body.name.trim()) return reply(res, 400, { error: 'Squad name is required.' });
      const squad = await store.createSquad({ id: id('squad'), departmentId: createSquadMatch[1], name: body.name.trim(), adminUserId: body?.adminUserId });
      return squad ? reply(res, 201, { squad }) : reply(res, 403, { error: 'Not allowed.' });
    }
    const memberMatch = url.pathname.match(/^\/squads\/([^/]+)\/members$/);
    if (req.method === 'POST' && memberMatch) {
      const squad = await store.addSquadMember({ squadId: memberMatch[1], adminUserId: body?.adminUserId, userId: body?.userId });
      return squad ? reply(res, 200, { squad }) : reply(res, 403, { error: 'Not allowed.' });
    }
    if (req.method === 'POST' && url.pathname === '/devices/register') {
      if (!body?.deviceId || !/^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(body?.pushToken || '')) return reply(res, 400, { error: 'Invalid device registration.' });
      await store.registerDevice(body.deviceId, body.pushToken); return reply(res, 200, { registered: true });
    }
    if (req.method === 'POST' && url.pathname === '/navigation-watches') {
      const valid = body?.watcherDeviceId && body?.partnerId && validLocation(body?.anchorLocation) && ['apple', 'google'].includes(body?.provider) && await store.getPushToken(body.watcherDeviceId);
      if (!valid) return reply(res, 400, { error: 'Invalid navigation watch.' });
      await store.saveNavigationWatch({ watcherDeviceId: body.watcherDeviceId, partnerId: body.partnerId, anchorLocation: body.anchorLocation, provider: body.provider, lastAlertAt: 0 });
      return reply(res, 200, { watching: true, movementThresholdMeters: MOVE_METERS });
    }
    if (req.method === 'POST' && url.pathname === '/locations') {
      const valid = typeof body?.id === 'string' && typeof body?.name === 'string' && typeof body?.unit === 'string' && validLocation(body?.location) && Number.isFinite(body.location.timestamp);
      if (!valid) return reply(res, 400, { error: 'Invalid location.' });
      const now = Date.now();
      const previous = await store.getPartner(body.id);
      const partner = { id: body.id, name: body.name, unit: body.unit, callSign: body.callSign || null, avatarColor: body.avatarColor || '#27AE60', dutyStatus: body.dutyStatus || 'available', occupants: Array.isArray(body.occupants) ? body.occupants.slice(0, 2) : [body.name], occupantCallSigns: Array.isArray(body.occupantCallSigns) ? body.occupantCallSigns.slice(0, 2) : [body.callSign].filter(Boolean), connection: { online: true, quality: 'good', lastSeenAt: now }, location: body.location };
      await store.savePartner(partner);
      if (partner.dutyStatus === 'cover_requested' && previous?.dutyStatus !== 'cover_requested') void sendCoverAlerts(partner);
      return reply(res, 202, { accepted: true, serverTimestamp: now });
    }
    return res.writeHead(404).end();
  } catch (error) {
    console.error(error);
    return reply(res, 400, { error: 'We could not complete that request. Please try again.' });
  }
});

const sockets = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/partners' || url.searchParams.get('token') !== token) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
  sockets.handleUpgrade(req, socket, head, (client) => sockets.emit('connection', client));
});
sockets.on('connection', async (client) => {
  clients.add(client);
  send(client, { type: 'snapshot', partners: (await store.listPartners()).map(publicPartner) });
  client.on('close', () => clients.delete(client));
});

await store.connectStorage();
await store.subscriber.subscribe(store.PARTNER_CHANNEL, (raw) => {
  const partner = JSON.parse(raw);
  broadcast({ type: 'partner:update', partner: publicPartner(partner) });
  void notifyWatches(partner);
});
setInterval(async () => broadcast({ type: 'snapshot', partners: (await store.listPartners()).map(publicPartner) }), 15_000).unref();
server.listen(port, () => console.log(`SquadNav server listening on http://localhost:${port}`));

async function shutdown() { sockets.close(); server.close(); await store.closeStorage(); process.exit(0); }
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
