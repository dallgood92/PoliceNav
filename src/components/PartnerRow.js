import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { distanceInMeters, formatDistance } from '../utils/geo';
import { getPartnerPresence } from '../utils/presence';

export default function PartnerRow({ partner, userLocation, onPress }) {
  const distance = userLocation ? distanceInMeters(userLocation.coords, partner.location) : Infinity;
  const presence = getPartnerPresence(partner);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${partner.name}, ${presence.label}, ${formatDistance(distance)} away`}
      onPress={() => onPress(partner)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.badge}><Text style={styles.badgeText}>{partner.name[0]}</Text></View>
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <View style={[styles.presenceDot, styles[`${presence.quality}Dot`]]} />
          <Text style={styles.name}>{partner.name}</Text>
        </View>
        <Text style={styles.unit}>{partner.unit}</Text>
        <Text style={[styles.presence, styles[`${presence.quality}Text`]]}>{presence.label}</Text>
      </View>
      <Text style={styles.distance}>{formatDistance(distance)}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.panel },
  pressed: { backgroundColor: colors.panelRaised },
  badge: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.background, fontSize: 19, fontWeight: '900' },
  identity: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  presenceDot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  goodDot: { backgroundColor: colors.success },
  weakDot: { backgroundColor: colors.warning },
  offlineDot: { backgroundColor: colors.muted },
  name: { color: colors.text, fontSize: 18, fontWeight: '800' },
  unit: { color: colors.muted, fontSize: 13, marginTop: 2 },
  presence: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  goodText: { color: colors.success },
  weakText: { color: colors.warning },
  offlineText: { color: colors.muted },
  distance: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chevron: { color: colors.accent, fontSize: 30, marginLeft: 8 },
});
