import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Waiting';
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

export default function LocationStats({ location, compact = false }) {
  const coords = location?.coords;
  const accuracyFeet = Number.isFinite(coords?.accuracy) ? Math.round(coords.accuracy * 3.28084) : null;

  return (
    <View style={[styles.grid, compact && styles.compactGrid]}>
      <View style={styles.item}>
        <Text style={styles.label}>ACCURACY</Text>
        <Text style={styles.value}>{accuracyFeet === null ? '—' : `± ${accuracyFeet} ft`}</Text>
      </View>
      <View style={styles.item}>
        <Text style={styles.label}>UPDATED</Text>
        <Text style={styles.value}>{formatTimestamp(location?.timestamp)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', marginHorizontal: 14, borderRadius: 12, overflow: 'hidden' },
  compactGrid: { marginHorizontal: 4 },
  item: { width: '50%', padding: 13, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 0.5 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  value: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
