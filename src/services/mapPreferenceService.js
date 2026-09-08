import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@blockwatch/preferred-map';
export const MAP_PREFERENCES = ['automatic', 'ask', 'apple', 'google'];

export async function loadMapPreference() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  return MAP_PREFERENCES.includes(saved) ? saved : 'automatic';
}

export async function saveMapPreference(preference) {
  if (!MAP_PREFERENCES.includes(preference)) {
    throw new Error('Unsupported map preference.');
  }
  await AsyncStorage.setItem(STORAGE_KEY, preference);
}
