import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { lastName } from '../utils/name';

export default function DutyAssignmentCard({ officer, partners = [], assignment, onChange, dense = false }) {
  const [editing, setEditing] = useState(false);
  const statusLabel = assignment.status === 'pursuit' ? 'PURSUIT' : assignment.status === 'cover_requested' ? 'COVER REQUESTED' : assignment.status === 'traffic_stop' ? 'TRAFFIC STOP' : 'AVAILABLE';
  const highlighted = assignment.status !== 'available';
  return (
    <View style={[styles.card, dense && styles.denseCard, assignment.status === 'traffic_stop' && styles.stopCard, assignment.status === 'cover_requested' && styles.coverCard, assignment.status === 'pursuit' && styles.pursuitCard]}>
      <View style={styles.header}>
        <View><Text style={[styles.eyebrow, highlighted && styles.alertInk]}>MY CURRENT UNIT</Text><View style={styles.unitTitle}><View style={[styles.avatarDot, { backgroundColor: assignment.avatarColor }]} /><Text style={[styles.unit, dense && styles.denseUnit, highlighted && styles.alertInk]}>UNIT {assignment.unitNumber}</Text></View></View>
        <Pressable onPress={() => setEditing((value) => !value)}><Text style={[styles.edit, highlighted && styles.alertInk]}>{editing ? 'DONE' : 'EDIT'}</Text></Pressable>
      </View>
      <Text style={[styles.officers, dense && styles.denseOfficers, highlighted && styles.alertInk]}>
        {assignment.secondOfficer
          ? `${lastName(officer?.name || 'OFFICER').toUpperCase()} (${assignment.callSign || '—'}) / ${lastName(assignment.secondOfficer).toUpperCase()} (${assignment.secondOfficerCallSign || '—'})`
          : `${lastName(officer?.name || 'OFFICER').toUpperCase()} (${assignment.callSign || '—'})`}
      </Text>
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.editorScrim}>
        <View style={styles.editorModal}>
          <View style={styles.editorHeader}><Text style={styles.editorTitle}>EDIT CURRENT UNIT</Text><Pressable onPress={() => setEditing(false)}><Text style={styles.edit}>DONE</Text></Pressable></View>
          <View style={styles.inputs}>
            <View style={styles.inputGroup}><Text style={styles.inputLabel}>UNIT NUMBER</Text><TextInput value={assignment.unitNumber} onChangeText={(unitNumber) => onChange({ ...assignment, unitNumber })} placeholder="47" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} /></View>
            <View style={styles.inputGroup}><Text style={styles.inputLabel}>YOUR CALL SIGN</Text><TextInput value={assignment.callSign} onChangeText={(callSign) => onChange({ ...assignment, callSign })} placeholder="Call sign" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} /></View>
          </View>
          <Text style={styles.label}>SECOND OFFICER</Text>
          <Pressable onPress={() => onChange({ ...assignment, secondOfficer: null, secondOfficerCallSign: null })} style={[styles.choice, !assignment.secondOfficer && styles.choiceActive]}><Text style={styles.choiceText}>None — one officer</Text></Pressable>
          {partners.map((partner) => <Pressable key={partner.id} onPress={() => onChange({ ...assignment, secondOfficer: partner.name, secondOfficerCallSign: partner.callSign || null })} style={[styles.choice, assignment.secondOfficer === partner.name && styles.choiceActive]}><Text style={styles.choiceText}>{lastName(partner.name)}{partner.callSign ? ` (${partner.callSign})` : ''}</Text></Pressable>)}
        </View>
        </View>
      </Modal>
      <Text style={[styles.label, dense && styles.denseLabel, highlighted && styles.alertInk]}>MY STATUS · {statusLabel}</Text>
      <View style={styles.statusRow}>
        <Pressable onPress={() => onChange({ ...assignment, status: 'available' })} style={[styles.status, dense && styles.denseStatus, assignment.status === 'available' && styles.available]}><Text style={styles.statusText}>CLEAR</Text></Pressable>
        <Pressable onPress={() => onChange({ ...assignment, status: 'traffic_stop' })} style={[styles.status, dense && styles.denseStatus, assignment.status === 'traffic_stop' && styles.stop]}><Text style={styles.statusText}>TRAFFIC STOP</Text></Pressable>
        <Pressable onPress={() => onChange({ ...assignment, status: 'cover_requested' })} style={[styles.status, dense && styles.denseStatus, assignment.status === 'cover_requested' && styles.cover]}><Text style={styles.statusText}>REQUEST COVER</Text></Pressable>
        <Pressable onPress={() => onChange({ ...assignment, status: 'pursuit' })} style={[styles.status, dense && styles.denseStatus, assignment.status === 'pursuit' && styles.pursuit]}><Text style={styles.statusText}>PURSUIT</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  denseCard: { marginHorizontal: 4, marginTop: 2, paddingHorizontal: 11, paddingVertical: 9 },
  stopCard: { borderColor: colors.accent, backgroundColor: colors.accent },
  coverCard: { borderColor: colors.danger, backgroundColor: colors.danger },
  pursuitCard: { borderColor: '#3478F6', backgroundColor: '#B91C2C' },
  alertInk: { color: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  unitTitle: { flexDirection: 'row', alignItems: 'center', marginTop: 3 }, avatarDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF', marginRight: 7 },
  unit: { color: colors.text, fontSize: 19, fontWeight: '900' }, edit: { color: colors.accent, fontWeight: '900' },
  denseUnit: { fontSize: 17 },
  officers: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, editor: { marginTop: 12 }, inputs: { flexDirection: 'row', gap: 8 },
  denseOfficers: { fontSize: 10, lineHeight: 13, marginTop: 3 },
  editorScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 20 }, editorModal: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 18 }, editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, editorTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  inputGroup: { flex: 1 }, inputLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', marginBottom: 5, letterSpacing: 0.7 },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.text, paddingHorizontal: 12, backgroundColor: colors.background },
  label: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 13, marginBottom: 6 },
  denseLabel: { fontSize: 9, marginTop: 7, marginBottom: 4 },
  choice: { padding: 9, borderRadius: 7, marginTop: 4, backgroundColor: colors.background }, choiceActive: { borderWidth: 1, borderColor: colors.accent }, choiceText: { color: colors.text, fontWeight: '700' },
  statusRow: { flexDirection: 'row', gap: 6 }, status: { flex: 1, minHeight: 42, borderRadius: 7, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  denseStatus: { minHeight: 34 },
  statusText: { color: colors.text, textAlign: 'center', fontSize: 8, fontWeight: '900' }, available: { backgroundColor: '#22613A', borderColor: colors.success }, stop: { backgroundColor: '#705A10', borderColor: colors.accent }, cover: { backgroundColor: '#791F28', borderColor: colors.danger }, pursuit: { backgroundColor: '#173F8A', borderColor: '#5EA0FF' },
});
