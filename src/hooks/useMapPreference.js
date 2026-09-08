import { useEffect, useState } from 'react';
import { loadMapPreference, saveMapPreference } from '../services/mapPreferenceService';

export function useMapPreference() {
  const [preference, setPreferenceState] = useState('automatic');

  useEffect(() => {
    loadMapPreference().then(setPreferenceState).catch(() => {});
  }, []);

  const setPreference = async (nextPreference) => {
    setPreferenceState(nextPreference);
    await saveMapPreference(nextPreference);
  };

  return { preference, setPreference };
}
