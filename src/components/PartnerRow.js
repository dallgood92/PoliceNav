import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { distanceInMeters, formatDistance } from '../utils/geo';
import { getPartnerPresence } from '../utils/presence';
import { lastName } from '../utils/name';

export default function PartnerRow({ partner, userLocation, onPress }) {
  const distance = userLocation ? distanceInMeters(userLocation.coords, partner.location) : Infinity;
  const presence = getPartnerPresence(partner);

  const alertStyle = partner.dutyStatus === 'cover_requested'
    ? styles.coverAlert
    : partner.dutyStatus === 'traffic_stop' ? styles.trafficStop : null;
  const dutyLabel = partner.dutyStatus === 'cover_requested'
    ? 'COVER REQUESTED'
    : partner.dutyStatus === 'traffic_stop' ? 'TRAFFIC STOP' : null;
  const highlighted = Boolean(alertStyle);
  const crew = (partner.occupants?.length ? partner.occupants : [partner.name])
    .map((name, index) => ({ name: lastName(name), callSign: partner.occupantCallSigns?.[index] || (index === 0 ? partner.callSign : null) || '—' }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${partner.name}, ${presence.label}, ${formatDistance(distance)} away`}
      onPress={() => onPress(partner)}
      style={({ pressed }) => [styles.row, alertStyle, pressed && styles.pressed]}
    >
      <View style={[styles.badge, { backgroundColor: partner.avatarColor || '#2563EB' }, highlighted && styles.alertBadge]}>
        {crew.map((member, index) => (
          <View key={`badge-${member.callSign}`} style={styles.badgeLine}>
            {index ? <View style={styles.badgeDivider} /> : null}
            <Text style={styles.badgeText}>{member.callSign}</Text>
          </View>
        ))}
      </View>
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <View style={styles.crewRow}>
            {crew.map((member) => (
              <View key={`${member.name}-${member.callSign}`} style={styles.crewMember}>
                <Text numberOfLines={1} style={[styles.name, highlighted && styles.alertInk]}>{member.name}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={[styles.unit, highlighted && styles.alertInk]}>{partner.unit}</Text>
        {dutyLabel ? <Text style={[styles.duty, highlighted && styles.alertInk]}>{dutyLabel}</Text> : null}
        <View style={styles.presenceRow}>
          <View style={[styles.presenceDot, styles[`${presence.quality}Dot`], highlighted && styles.alertPresenceDot]} />
          <Text style={[styles.presence, styles[`${presence.quality}Text`], highlighted && styles.alertInk]}>{presence.label}</Text>
        </View>
      </View>
      <Text style={[styles.distance, highlighted && styles.alertInk]}>{formatDistance(distance)}</Text>
      <Text style={[styles.chevron, highlighted && styles.alertInk]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 96, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 10, marginBottom: 7, borderColor: colors.border, backgroundColor: colors.panel },
  trafficStop: { backgroundColor: colors.accent, borderColor: colors.accent },
  coverAlert: { backgroundColor: colors.danger, borderColor: colors.danger },
  alertInk: { color: colors.background },
  pressed: { backgroundColor: colors.panelRaised },
  badge: { width: 54, minHeight: 56, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 5 },
  badgeLine: { alignItems: 'center' },
  badgeDivider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.65)', marginVertical: 3 },
  badgeText: { color: colors.text, fontSize: 14, lineHeight: 16, fontWeight: '900', letterSpacing: 0.5 },
  alertBadge: { borderColor: 'rgba(255,255,255,0.9)' },
  identity: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start' },
  crewRow: { flex: 1, flexDirection: 'column' },
  crewMember: { minWidth: 0, marginBottom: 2 },
  presenceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  presenceDot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  alertPresenceDot: { backgroundColor: colors.background },
  goodDot: { backgroundColor: colors.success },
  weakDot: { backgroundColor: colors.warning },
  offlineDot: { backgroundColor: colors.muted },
  name: { color: colors.text, fontSize: 16, lineHeight: 19, fontWeight: '900', letterSpacing: 0.1 },
  unit: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  duty: { fontSize: 11, fontWeight: '900', marginTop: 3, letterSpacing: 0.6 },
  presence: { fontSize: 11, fontWeight: '700' },
  goodText: { color: colors.success },
  weakText: { color: colors.warning },
  offlineText: { color: colors.muted },
  distance: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chevron: { color: colors.accent, fontSize: 30, marginLeft: 8 },
});
