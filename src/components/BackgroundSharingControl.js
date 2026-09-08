import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useBackgroundSharing } from '../hooks/useBackgroundSharing';
import { colors } from '../theme/colors';

export default function BackgroundSharingControl() {
  const { status, error, toggle } = useBackgroundSharing();
  const configured = status !== 'unconfigured';
  const available = !['checking', 'unavailable'].includes(status);
  const active = status === 'active';

  return (
    <View style={styles.panel}>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, active ? styles.activeDot : styles.inactiveDot]} />
          <Text style={styles.title}>PARTNER SHARING</Text>
        </View>
        <Text style={styles.detail}>
          {!configured ? 'Server setup required' : active ? 'Live—even in background' : 'Location is not being shared'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: active, disabled: !available }}
        disabled={!available}
        onPress={toggle}
        style={[styles.button, active && styles.stopButton, !available && styles.disabled]}
      >
        <Text style={[styles.buttonText, active && styles.stopText]}>{active ? 'STOP' : 'START'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginHorizontal: 14, marginTop: 10, padding: 13, borderRadius: 12, backgroundColor: colors.panel },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  activeDot: { backgroundColor: colors.success },
  inactiveDot: { backgroundColor: colors.muted },
  title: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  detail: { color: colors.muted, fontSize: 12, marginTop: 4 },
  button: { minWidth: 72, minHeight: 40, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stopButton: { backgroundColor: colors.panelRaised, borderWidth: 1, borderColor: colors.danger },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 12 },
  stopText: { color: colors.danger },
  disabled: { opacity: 0.4 },
  error: { width: '100%', color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 9 },
});
