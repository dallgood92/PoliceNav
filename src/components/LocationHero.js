import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { deriveHundredBlock, formatLocality, formatStreet } from '../utils/address';
import { formatDirection } from '../utils/direction';

export default function LocationHero({ location, heading, address, crossStreet, nearbyPlace }) {
  const block = deriveHundredBlock(address);
  const direction = formatDirection({
    course: location?.coords.heading,
    speed: location?.coords.speed,
    compassHeading: heading?.trueHeading >= 0 ? heading.trueHeading : heading?.magHeading,
  });

  return (
    <View style={styles.container} accessibilityRole="summary">
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE LOCATION</Text>
      </View>
      {block ? <Text style={styles.block}>{block}</Text> : null}
      <Text style={styles.street} numberOfLines={2}>{formatStreet(address)}</Text>
      {crossStreet ? (
        <View style={styles.markerPanel}>
          <Text style={styles.markerLabel}>NEAREST CROSS STREET</Text>
          <Text style={styles.markerValue}>{crossStreet.name}</Text>
          <Text style={styles.markerDistance}>{Math.round(crossStreet.distanceMeters * 3.28084)} FT AWAY</Text>
        </View>
      ) : null}
      {nearbyPlace ? (
        <View style={styles.landmark}>
          <Text style={styles.landmarkLabel}>NEARBY LANDMARK</Text>
          <Text style={styles.nearbyPlace} numberOfLines={1}>{nearbyPlace.toUpperCase()}</Text>
        </View>
      ) : null}
      <Text style={styles.direction}>{direction.label}</Text>
      <Text style={styles.locality}>{formatLocality(address)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 22 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success, marginRight: 8 },
  liveText: { color: colors.success, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  block: { color: colors.accent, fontSize: 38, fontWeight: '900', textAlign: 'center' },
  street: { color: colors.text, fontSize: 31, lineHeight: 36, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  markerPanel: { alignItems: 'center', backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8, marginTop: 13 },
  markerLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  markerValue: { color: colors.accent, fontSize: 25, fontWeight: '900', marginTop: 1 },
  markerDistance: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 1 },
  landmark: { alignItems: 'center', marginTop: 13 },
  landmarkLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  nearbyPlace: { color: colors.accent, fontSize: 15, fontWeight: '900', letterSpacing: 0.6, marginTop: 3, textAlign: 'center' },
  direction: { color: colors.text, fontSize: 25, fontWeight: '800', textAlign: 'center', marginTop: 13 },
  locality: { color: colors.muted, fontSize: 17, marginTop: 9 },
});
