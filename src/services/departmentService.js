import { apiRequest, getDeviceId } from './locationApi';

export async function upsertOfficer(profile) {
  return apiRequest('/users/upsert', {
    method: 'POST',
    body: JSON.stringify({ ...profile, deviceId: await getDeviceId() }),
  });
}

export const listDepartments = () => apiRequest('/departments');
export const getOfficerWorkspace = (userId) => apiRequest(`/users/${encodeURIComponent(userId)}/workspace`);
export const createDepartment = (name, creatorUserId) => apiRequest('/departments', {
  method: 'POST', body: JSON.stringify({ name, creatorUserId }),
});
export const requestDepartmentAccess = (departmentId, userId) => apiRequest(`/departments/${departmentId}/requests`, {
  method: 'POST', body: JSON.stringify({ userId }),
});
export const approveDepartmentRequest = (requestId, adminUserId) => apiRequest(`/department-requests/${requestId}/approve`, {
  method: 'POST', body: JSON.stringify({ adminUserId }),
});
export const createSquad = (departmentId, name, adminUserId) => apiRequest(`/departments/${departmentId}/squads`, {
  method: 'POST', body: JSON.stringify({ name, adminUserId }),
});
export const assignSquadMember = (squadId, userId, adminUserId) => apiRequest(`/squads/${squadId}/members`, {
  method: 'POST', body: JSON.stringify({ userId, adminUserId }),
});
