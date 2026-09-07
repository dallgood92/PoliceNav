import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { openNavigationTo } from '../services/navigationService';
import { colors } from '../theme/colors';
import { getPartnerPresence } from '../utils/presence';

export default function PartnerDetailScreen({ partner, onBack }) {
  const presence = getPartnerPresence(partner);
  const openNavigation = async () => {
    try {
      await openNavigationTo(partner);
    } catch (error) {
      Alert.alert('Unable to open navigation', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ PARTNERS</Text>
      </Pressable>
      <View style={styles.content}>
        <View style={styles.badge}><Text style={styles.badgeText}>{partner.name[0]}</Text></View>
        <Text style={styles.name}>{partner.name}</Text>
        <Text style={styles.unit}>{partner.unit}</Text>
        <View style={styles.statusPill}>
          <View style={[styles.presenceDot, styles[`${presence.quality}Dot`]]} />
          <Text style={[styles.status, styles[`${presence.quality}Text`]]}>{presence.label.toUpperCase()}</Text>
        </View>
        <Text style={styles.label}>MOCK LOCATION</Text>
        <Text selectable style={styles.coordinates}>
          {partner.location.latitude.toFixed(6)}, {partner.location.longitude.toFixed(6)}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={openNavigation}
          style={({ pressed }) => [styles.navigateButton, pressed && styles.pressed]}
        >
          <Text style={styles.navigateText}>OPEN DIRECTIONS</Text>
        </Pressable>
        <Text style={styles.note}>This is a map handoff using demo coordinates. Live partner positions will come from the planned backend.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backButton: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 18 },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 44 },
  badge: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.background, fontSize: 42, fontWeight: '900' },
  name: { color: colors.text, fontSize: 36, fontWeight: '900', marginTop: 16 },
  unit: { color: colors.muted, fontSize: 19, marginTop: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginTop: 16 },
  presenceDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  goodDot: { backgroundColor: colors.success },
  weakDot: { backgroundColor: colors.warning },
  offlineDot: { backgroundColor: colors.muted },
  status: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  goodText: { color: colors.success },
  weakText: { color: colors.warning },
  offlineText: { color: colors.muted },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 38 },
  coordinates: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 6 },
  navigateButton: { width: '100%', minHeight: 58, backgroundColor: colors.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 34 },
  pressed: { opacity: 0.8 },
  navigateText: { color: colors.background, fontSize: 17, fontWeight: '900', letterSpacing: 0.8 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18 },
});
