import { Linking, Platform } from 'react-native';

export async function openNavigationTo(partner) {
  const { latitude, longitude } = partner.location;
  const label = encodeURIComponent(`${partner.unit} ${partner.name}`);
  const destination = `${latitude},${longitude}`;
  const url = Platform.select({
    ios: `maps://?daddr=${destination}&q=${label}`,
    android: `google.navigation:q=${destination}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
  });

  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
  }
  return Linking.openURL(url);
}
