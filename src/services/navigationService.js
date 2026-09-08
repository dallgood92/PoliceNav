import { Linking, Platform } from 'react-native';
import { armMovingPartnerAlert } from './notificationService';

export const mapOptions = Platform.select({
  ios: [
    { value: 'automatic', label: 'Automatic (Apple Maps)' },
    { value: 'ask', label: 'Ask every time' },
    { value: 'apple', label: 'Apple Maps' },
    { value: 'google', label: 'Google Maps' },
  ],
  default: [
    { value: 'automatic', label: 'Automatic (Google Maps)' },
    { value: 'ask', label: 'Ask every time' },
    { value: 'google', label: 'Google Maps' },
  ],
});

export function availableMapChoices() {
  return Platform.OS === 'ios' ? ['apple', 'google'] : ['google'];
}

export function mapLabel(preference) {
  return mapOptions.find((option) => option.value === preference)?.label ?? 'Automatic';
}

export function resolveMapProvider(preference) {
  return preference === 'automatic'
    ? (Platform.OS === 'ios' ? 'apple' : 'google')
    : preference;
}

export async function openNavigationTo(partner, preference = 'automatic', { armAlert = true } = {}) {
  const { latitude, longitude } = partner.location;
  const destination = `${latitude},${longitude}`;
  const provider = resolveMapProvider(preference);
  const url = provider === 'apple'
    ? `https://maps.apple.com/directions?destination=${destination}&mode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

  if (armAlert) {
    await armMovingPartnerAlert(partner, provider);
  }
  return Linking.openURL(url);
}
