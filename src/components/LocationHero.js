import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { deriveHundredBlock, formatLocality, formatStreet } from '../utils/address';
import { formatDirection } from '../utils/direction';

export default function LocationHero({ location, heading, address, mileMarker }) {
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
      {mileMarker ? (
        <View style={styles.markerPanel}>
          <Text style={styles.markerLabel}>{mileMarker.route} · REFERENCE MARKER</Text>
          <Text style={styles.markerValue}>{mileMarker.marker}</Text>
          <Text style={styles.markerDistance}>NEAREST POST · {(mileMarker.distanceMeters / 1609.344).toFixed(1)} MI</Text>
        </View>
      ) : null}
      <Text style={styles.arrow}>{direction.arrow}</Text>
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
  arrow: { color: colors.accent, fontSize: 66, lineHeight: 72, marginTop: 12 },
  direction: { color: colors.text, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  locality: { color: colors.muted, fontSize: 17, marginTop: 9 },
});
