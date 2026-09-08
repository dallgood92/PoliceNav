import { useCallback, useEffect, useState } from 'react';
import { getOfficerWorkspace } from '../services/departmentService';

export function useDepartmentWorkspace(userId) {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try { setWorkspace(await getOfficerWorkspace(userId)); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { workspace, loading, refresh };
}
