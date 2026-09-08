import { useCallback, useEffect, useState } from 'react';
import { backgroundSharingStatus, startBackgroundSharing, stopBackgroundSharing } from '../services/backgroundLocationService';

export function useBackgroundSharing() {
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    backgroundSharingStatus().then(setStatus).catch(() => setStatus('unavailable'));
  }, []);

  useEffect(refresh, [refresh]);

  const toggle = async () => {
    setError(null);
    try {
      if (status === 'active') await stopBackgroundSharing();
      else await startBackgroundSharing();
      refresh();
    } catch (nextError) {
      setError(nextError.message);
      refresh();
    }
  };

  return { status, error, toggle };
}
