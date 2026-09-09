import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { upsertOfficer } from '../services/departmentService';
import { getDeviceId } from '../services/locationApi';
import { loadDutyAssignment, saveDutyAssignment } from '../services/dutyService';

const SESSION_KEY = '@blockwatch/officer-session';
const PROFILE_VERSION = 2;

export function useOfficerSession() {
  const [officer, setOfficer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then(async (saved) => {
        if (!saved) return;
        const profile = JSON.parse(saved);
        if (!profile?.id || !profile?.name) return;
        const migratedProfile = { ...profile, profileVersion: PROFILE_VERSION };
        if (profile.profileVersion !== PROFILE_VERSION) {
          await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(migratedProfile));
        }
        setOfficer(migratedProfile);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const register = async ({ firstName, lastName, callSign, unitNumber }) => {
    setError(null);
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const profile = {
        id: deviceId,
        email: `${deviceId}@device.squadnav.local`,
        name: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        callSign: callSign.trim(),
        unitNumber: unitNumber.trim(),
      };
      const result = await upsertOfficer(profile);
      const savedOfficer = { ...result.user, callSign: profile.callSign, unitNumber: profile.unitNumber, profileVersion: PROFILE_VERSION };
      const duty = await loadDutyAssignment();
      await saveDutyAssignment({ ...duty, callSign: profile.callSign, unitNumber: profile.unitNumber });
      setOfficer(savedOfficer);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(savedOfficer));
    } catch (registrationError) {
      setError(registrationError?.message || 'Your profile could not be saved. Check the server connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setOfficer(null);
  };

  return { officer, loading, error, register, signOut };
}
