import * as Location from 'expo-location';

export async function reverseGeocode(latitude, longitude) {
  const matches = await Location.reverseGeocodeAsync({ latitude, longitude });
  return matches[0] ?? null;
}
