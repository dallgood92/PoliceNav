import pg from 'pg';
import { createClient } from 'redis';

const { Pool } = pg;
const PARTNER_TTL_SECONDS = 86_400;
const WATCH_TTL_SECONDS = 14_400;
const PARTNER_IDS_KEY = 'blockwatch:partner-ids';
const WATCH_IDS_KEY = 'blockwatch:navigation-watch-ids';
export const PARTNER_CHANNEL = 'blockwatch:partner-updates';

export const database = new Pool({ connectionString: process.env.DATABASE_URL });
export const redis = createClient({ url: process.env.REDIS_URL });
export const subscriber = redis.duplicate();

const userFromRow = (row) => row && ({
  id: row.id,
  email: row.email,
  name: row.name,
  picture: row.picture,
  deviceId: row.device_id,
  departmentId: row.department_id,
  role: row.role,
  firstName: row.first_name,
  lastName: row.last_name,
  callSign: row.call_sign,
  unitNumber: row.unit_number,
});

const departmentFromRow = (row) => row && ({
  id: row.id,
  name: row.name,
  createdBy: row.created_by,
  createdAt: Number(row.created_at),
  ...(row.member_count === undefined ? {} : { memberCount: Number(row.member_count) }),
});

const requestFromRow = (row) => row && ({
  id: row.id,
  departmentId: row.department_id,
  userId: row.user_id,
  status: row.status,
  createdAt: Number(row.created_at),
});

const squadFromRow = (row) => row && ({
  id: row.id,
  departmentId: row.department_id,
  name: row.name,
  memberIds: row.member_ids || [],
});

export async function connectStorage() {
  await Promise.all([database.query('SELECT 1'), redis.connect(), subscriber.connect()]);
}

export async function storageHealth() {
  const [departmentResult, partnerIds, watchIds] = await Promise.all([
    database.query('SELECT COUNT(*)::int AS count FROM departments'),
    redis.sCard(PARTNER_IDS_KEY),
    redis.sCard(WATCH_IDS_KEY),
  ]);
  return { departments: departmentResult.rows[0].count, partners: partnerIds, watches: watchIds };
}

export async function upsertUser(input) {
  const result = await database.query(
    `INSERT INTO users (id, email, name, picture, device_id, first_name, last_name, call_sign, unit_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (device_id) DO UPDATE SET
       email = EXCLUDED.email, name = EXCLUDED.name,
       picture = EXCLUDED.picture, first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name, call_sign = EXCLUDED.call_sign,
       unit_number = EXCLUDED.unit_number
     RETURNING *`,
    [input.id, input.email, input.name, input.picture || null, input.deviceId, input.firstName || null, input.lastName || null, input.callSign, input.unitNumber],
  );
  return userFromRow(result.rows[0]);
}

export async function getUser(id, client = database) {
  const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
  return userFromRow(result.rows[0]);
}

export async function listDepartments() {
  const result = await database.query(
    `SELECT d.*, COUNT(u.id)::int AS member_count
     FROM departments d LEFT JOIN users u ON u.department_id = d.id
     GROUP BY d.id ORDER BY d.name`,
  );
  return result.rows.map(departmentFromRow);
}

export async function getWorkspace(userId) {
  const user = await getUser(userId);
  if (!user) return null;
  const [departmentResult, squadsResult, requestResult] = await Promise.all([
    user.departmentId ? database.query('SELECT * FROM departments WHERE id = $1', [user.departmentId]) : { rows: [] },
    database.query(
      `SELECT s.*, COALESCE(array_agg(sm2.user_id) FILTER (WHERE sm2.user_id IS NOT NULL), '{}') AS member_ids
       FROM squads s
       JOIN squad_members mine ON mine.squad_id = s.id AND mine.user_id = $1
       LEFT JOIN squad_members sm2 ON sm2.squad_id = s.id
       GROUP BY s.id ORDER BY s.name`,
      [userId],
    ),
    database.query("SELECT * FROM department_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1", [userId]),
  ]);
  const squads = squadsResult.rows.map(squadFromRow);
  const visibleUserIds = [...new Set(squads.flatMap((squad) => squad.memberIds))];
  const visibleResult = visibleUserIds.length
    ? await database.query('SELECT device_id FROM users WHERE id = ANY($1::text[])', [visibleUserIds])
    : { rows: [] };
  let admin = null;
  if (user.role === 'admin' && user.departmentId) {
    const [requestsResult, membersResult, allSquadsResult] = await Promise.all([
      database.query(
        `SELECT r.*, row_to_json(u) AS request_user
         FROM department_requests r JOIN users u ON u.id = r.user_id
         WHERE r.department_id = $1 AND r.status = 'pending' ORDER BY r.created_at`,
        [user.departmentId],
      ),
      database.query('SELECT * FROM users WHERE department_id = $1 ORDER BY name', [user.departmentId]),
      database.query(
        `SELECT s.*, COALESCE(array_agg(sm.user_id) FILTER (WHERE sm.user_id IS NOT NULL), '{}') AS member_ids
         FROM squads s LEFT JOIN squad_members sm ON sm.squad_id = s.id
         WHERE s.department_id = $1 GROUP BY s.id ORDER BY s.name`,
        [user.departmentId],
      ),
    ]);
    admin = {
      requests: requestsResult.rows.map((row) => ({ ...requestFromRow(row), user: userFromRow(row.request_user) })),
      members: membersResult.rows.map(userFromRow),
      squads: allSquadsResult.rows.map(squadFromRow),
    };
  }
  return {
    user,
    department: departmentFromRow(departmentResult.rows[0]) || null,
    squads,
    visibleDeviceIds: visibleResult.rows.map((row) => row.device_id),
    pendingRequest: requestFromRow(requestResult.rows[0]) || null,
    admin,
  };
}

export async function createDepartment({ id, name, creatorUserId, squadId, createdAt }) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    const creator = await getUser(creatorUserId, client);
    if (!creator || creator.departmentId) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query('INSERT INTO departments (id, name, created_by, created_at) VALUES ($1, $2, $3, $4)', [id, name, creatorUserId, createdAt]);
    await client.query("UPDATE users SET department_id = $1, role = 'admin' WHERE id = $2", [id, creatorUserId]);
    await client.query("INSERT INTO squads (id, department_id, name) VALUES ($1, $2, 'Patrol')", [squadId, id]);
    await client.query('INSERT INTO squad_members (squad_id, user_id) VALUES ($1, $2)', [squadId, creatorUserId]);
    await client.query('COMMIT');
    return getWorkspace(creatorUserId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createDepartmentRequest({ id, departmentId, userId, createdAt }) {
  const user = await getUser(userId);
  const department = await database.query('SELECT id FROM departments WHERE id = $1', [departmentId]);
  if (!user || user.departmentId || !department.rowCount) return null;
  const existing = await database.query("SELECT * FROM department_requests WHERE user_id = $1 AND status = 'pending'", [userId]);
  if (existing.rowCount) return requestFromRow(existing.rows[0]);
  const result = await database.query(
    "INSERT INTO department_requests (id, department_id, user_id, status, created_at) VALUES ($1, $2, $3, 'pending', $4) RETURNING *",
    [id, departmentId, userId, createdAt],
  );
  return requestFromRow(result.rows[0]);
}

export async function approveDepartmentRequest(requestId, adminUserId) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT r.*, a.role AS admin_role, a.department_id AS admin_department
       FROM department_requests r JOIN users a ON a.id = $2 WHERE r.id = $1 FOR UPDATE`,
      [requestId, adminUserId],
    );
    const request = result.rows[0];
    if (!request || request.status !== 'pending' || request.admin_role !== 'admin' || request.admin_department !== request.department_id) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query("UPDATE users SET department_id = $1, role = 'member' WHERE id = $2", [request.department_id, request.user_id]);
    await client.query("UPDATE department_requests SET status = 'approved' WHERE id = $1", [requestId]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createSquad({ id, departmentId, name, adminUserId }) {
  const admin = await getUser(adminUserId);
  if (admin?.role !== 'admin' || admin.departmentId !== departmentId) return null;
  const result = await database.query('INSERT INTO squads (id, department_id, name) VALUES ($1, $2, $3) RETURNING *', [id, departmentId, name]);
  return squadFromRow({ ...result.rows[0], member_ids: [] });
}

export async function addSquadMember({ squadId, userId, adminUserId }) {
  const result = await database.query(
    `SELECT s.*, a.role AS admin_role, a.department_id AS admin_department, u.department_id AS member_department
     FROM squads s JOIN users a ON a.id = $2 JOIN users u ON u.id = $3 WHERE s.id = $1`,
    [squadId, adminUserId, userId],
  );
  const row = result.rows[0];
  if (!row || row.admin_role !== 'admin' || row.admin_department !== row.department_id || row.member_department !== row.department_id) return null;
  await database.query('INSERT INTO squad_members (squad_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [squadId, userId]);
  const members = await database.query('SELECT user_id FROM squad_members WHERE squad_id = $1 ORDER BY user_id', [squadId]);
  return squadFromRow({ ...row, member_ids: members.rows.map((item) => item.user_id) });
}

export async function registerDevice(deviceId, pushToken) {
  await database.query(
    `INSERT INTO device_push_tokens (device_id, push_token, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (device_id) DO UPDATE SET push_token = EXCLUDED.push_token, updated_at = EXCLUDED.updated_at`,
    [deviceId, pushToken, Date.now()],
  );
}

export async function getPushToken(deviceId) {
  const result = await database.query('SELECT push_token FROM device_push_tokens WHERE device_id = $1', [deviceId]);
  return result.rows[0]?.push_token || null;
}

export async function listPushTokensExcept(deviceId) {
  const result = await database.query('SELECT push_token FROM device_push_tokens WHERE device_id <> $1', [deviceId]);
  return result.rows.map((row) => row.push_token);
}

const partnerKey = (id) => `blockwatch:partner:${id}`;
const watchKey = (id) => `blockwatch:navigation-watch:${id}`;

export async function savePartner(partner) {
  await redis.multi()
    .set(partnerKey(partner.id), JSON.stringify(partner), { EX: PARTNER_TTL_SECONDS })
    .sAdd(PARTNER_IDS_KEY, partner.id)
    .publish(PARTNER_CHANNEL, JSON.stringify(partner))
    .exec();
}

export async function getPartner(id) {
  const raw = await redis.get(partnerKey(id));
  return raw ? JSON.parse(raw) : null;
}

async function readRedisCollection(idsKey, keyForId) {
  const ids = await redis.sMembers(idsKey);
  if (!ids.length) return [];
  const values = await redis.mGet(ids.map(keyForId));
  const missing = ids.filter((_, index) => !values[index]);
  if (missing.length) await redis.sRem(idsKey, missing);
  return values.filter(Boolean).map(JSON.parse);
}

export const listPartners = () => readRedisCollection(PARTNER_IDS_KEY, partnerKey);

export async function saveNavigationWatch(watch) {
  await redis.multi()
    .set(watchKey(watch.watcherDeviceId), JSON.stringify(watch), { EX: WATCH_TTL_SECONDS })
    .sAdd(WATCH_IDS_KEY, watch.watcherDeviceId)
    .exec();
}

export const listNavigationWatches = () => readRedisCollection(WATCH_IDS_KEY, watchKey);

export async function closeStorage() {
  await Promise.allSettled([subscriber.quit(), redis.quit(), database.end()]);
}
