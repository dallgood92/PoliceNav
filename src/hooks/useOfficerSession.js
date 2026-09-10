import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { upsertOfficer } from '../services/departmentService';
import { getDeviceId } from '../services/locationApi';
import { loadDutyAssignment, saveDutyAssignment } from '../services/dutyService';

const SESSION_KEY = '@blockwatch/officer-session';
const SAVED_PROFILE_KEY = '@blockwatch/saved-officer-profile';
const PROFILE_VERSION = 2;

export function useOfficerSession() {
  const [officer, setOfficer] = useState(null);
  const [savedProfile, setSavedProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(SESSION_KEY), AsyncStorage.getItem(SAVED_PROFILE_KEY)])
      .then(async ([saved, remembered]) => {
        if (remembered) setSavedProfile(JSON.parse(remembered));
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

  const register = async ({ firstName, lastName, callSign, unitNumber, departmentCode }) => {
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
        departmentCode: departmentCode.trim(),
      };
      const result = await upsertOfficer(profile);
      const savedOfficer = { ...result.user, callSign: profile.callSign, unitNumber: profile.unitNumber, profileVersion: PROFILE_VERSION };
      const duty = await loadDutyAssignment();
      await saveDutyAssignment({ ...duty, callSign: profile.callSign });
      const rememberedProfile = { firstName: profile.firstName, lastName: profile.lastName, callSign: profile.callSign, unitNumber: profile.unitNumber };
      setOfficer(savedOfficer);
      setSavedProfile(rememberedProfile);
      await Promise.all([
        AsyncStorage.setItem(SESSION_KEY, JSON.stringify(savedOfficer)),
        AsyncStorage.setItem(SAVED_PROFILE_KEY, JSON.stringify(rememberedProfile)),
      ]);
    } catch (registrationError) {
      setError(registrationError?.message || 'Your profile could not be saved. Check the server connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (officer) {
      const rememberedProfile = {
        firstName: officer.firstName || officer.name?.split(' ')[0] || '',
        lastName: officer.lastName || officer.name?.split(' ').slice(1).join(' ') || '',
        callSign: officer.callSign || '',
        unitNumber: officer.unitNumber || '',
      };
      await AsyncStorage.setItem(SAVED_PROFILE_KEY, JSON.stringify(rememberedProfile));
      setSavedProfile(rememberedProfile);
    }
    await AsyncStorage.removeItem(SESSION_KEY);
    setOfficer(null);
  };

  return { officer, savedProfile, loading, error, register, signOut };
}
