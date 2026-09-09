import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { deriveHundredBlock, formatLocality, formatStreet } from '../utils/address';
import { formatDirection } from '../utils/direction';
import { colors } from '../theme/colors';

export default function PursuitScreen({ live, onTerminate }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const block = deriveHundredBlock(live.address) || 'BLOCK UNAVAILABLE';
  const direction = formatDirection({
    course: live.location?.coords.heading,
    speed: live.location?.coords.speed,
    compassHeading: live.heading?.trueHeading >= 0 ? live.heading.trueHeading : live.heading?.magHeading,
  }).label;

  return (
    <View style={[styles.screen, landscape && styles.screenLandscape]}>
      <View style={styles.topRow}>
        <View style={styles.pursuitFlag}><View style={styles.redDot} /><View style={styles.blueDot} /><Text style={styles.pursuitText}>PURSUIT MODE</Text></View>
        <Pressable accessibilityRole="button" onPress={onTerminate} style={styles.terminate}><Text style={styles.terminateText}>TERMINATE</Text></Pressable>
      </View>
      <View style={[styles.location, landscape && styles.locationLandscape]}>
        <View style={styles.primary}>
          <Text style={styles.label}>CURRENT LOCATION</Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={1} style={[styles.street, landscape && styles.streetLandscape]}>{formatStreet(live.address)}</Text>
          <Text style={styles.block}>{block}</Text>
          <Text style={styles.city}>{formatLocality(live.address)}</Text>
        </View>
        <View style={[styles.divider, landscape && styles.dividerLandscape]} />
        <View style={styles.secondary}>
          <Text style={styles.label}>HEADING</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heading}>{direction}</Text>
          <Text style={[styles.label, styles.crossLabel]}>UPCOMING CROSS STREET</Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={1} style={styles.cross}>{live.crossStreet?.name || 'UNAVAILABLE'}</Text>
          {live.crossStreet ? <Text style={styles.distance}>{Math.round(live.crossStreet.distanceMeters * 3.28084)} FT</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 18, paddingBottom: 14 },
  screenLandscape: { paddingHorizontal: 28 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  pursuitFlag: { flexDirection: 'row', alignItems: 'center' },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF233C', marginRight: 5 },
  blueDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3478F6', marginRight: 9 },
  pursuitText: { color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  terminate: { borderWidth: 1, borderColor: colors.danger, borderRadius: 7, paddingHorizontal: 13, paddingVertical: 8 },
  terminateText: { color: colors.danger, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  location: { flex: 1, justifyContent: 'space-evenly', alignItems: 'stretch', paddingVertical: 8 },
  locationLandscape: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 12 },
  primary: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  secondary: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  street: { color: colors.text, fontSize: 46, lineHeight: 52, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  streetLandscape: { fontSize: 42, lineHeight: 48 },
  block: { color: colors.accent, fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  city: { color: colors.muted, fontSize: 21, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 25 },
  dividerLandscape: { height: '78%', width: 1, alignSelf: 'center', marginHorizontal: 0 },
  heading: { color: colors.text, fontSize: 38, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  crossLabel: { marginTop: 30 },
  cross: { color: colors.accent, fontSize: 34, fontWeight: '900', marginTop: 9, textAlign: 'center' },
  distance: { color: colors.muted, fontSize: 15, fontWeight: '800', marginTop: 5 },
});
