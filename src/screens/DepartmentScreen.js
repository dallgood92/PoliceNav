import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  approveDepartmentRequest,
  assignSquadMember,
  createSquad,
  listDepartments,
  requestDepartmentAccess,
  removeDepartmentMember,
  removeSquadMember,
} from '../services/departmentService';
import { colors } from '../theme/colors';

export default function DepartmentScreen({ officer, workspace, refresh, onDone, onSignOut }) {
  const [departments, setDepartments] = useState([]);
  const [squadName, setSquadName] = useState('');
  const [message, setMessage] = useState(null);

  const loadDepartments = () => listDepartments().then((result) => setDepartments(result.departments)).catch(() => setMessage('Department list is temporarily unavailable.'));
  useEffect(() => {
    loadDepartments();
  }, []);

  const run = async (action, success) => {
    setMessage(null);
    try { await action(); setMessage(success); await refresh(); loadDepartments(); }
    catch { setMessage('That change could not be completed. Please try again.'); }
  };

  const admin = workspace?.admin;
  const confirmRemoval = (member) => Alert.alert(
    'Remove officer?',
    `${member.name}${member.callSign ? ` (${member.callSign})` : ''} will be removed from the department and must register again to regain access.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => run(() => removeDepartmentMember(workspace.department.id, member.id, officer.id), `${member.name} removed.`) },
    ],
  );
  const argyleDepartment = departments.find((department) => /argyle/i.test(department.name));
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        {workspace?.department ? <Pressable onPress={onDone}><Text style={styles.link}>‹ DASHBOARD</Text></Pressable> : <View />}
        <Pressable onPress={onSignOut}><Text style={styles.signOut}>SIGN OUT</Text></Pressable>
      </View>
      <Text style={styles.eyebrow}>SIGNED IN AS {officer.name.toUpperCase()}</Text>
      <Text style={styles.title}>{workspace?.department?.name || 'Join Argyle Police Department'}</Text>

      {!workspace?.department ? (
        <>
          {workspace?.pendingRequest ? <Text style={styles.pending}>REQUEST PENDING APPROVAL</Text> : null}
          <Text style={styles.section}>DEPARTMENT ACCESS</Text>
          {argyleDepartment ? (
            <View style={styles.row}>
              <View style={styles.grow}><Text style={styles.rowTitle}>{argyleDepartment.name}</Text><Text style={styles.muted}>{argyleDepartment.memberCount} members</Text></View>
              <Pressable disabled={Boolean(workspace?.pendingRequest)} onPress={() => run(() => requestDepartmentAccess(argyleDepartment.id, officer.id), 'Request sent to the Argyle PD administrator.')} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>{workspace?.pendingRequest ? 'PENDING' : 'JOIN'}</Text>
              </Pressable>
            </View>
          ) : <Text style={styles.muted}>Argyle Police Department is temporarily unavailable.</Text>}
        </>
      ) : (
        <>
          <Text style={styles.section}>YOUR SQUADS</Text>
          {workspace.squads.length ? workspace.squads.map((squad) => <View key={squad.id} style={styles.row}><Text style={styles.rowTitle}>{squad.name}</Text><Text style={styles.muted}>{squad.memberIds.length} members</Text></View>) : <Text style={styles.muted}>You have not been assigned to a squad.</Text>}
          {admin ? (
            <>
              <Text style={styles.section}>JOIN REQUESTS</Text>
              {admin.requests.length ? admin.requests.map((request) => (
                <View key={request.id} style={styles.row}><View style={styles.grow}><Text style={styles.rowTitle}>{request.user.name}</Text><Text style={styles.muted}>{request.user.email}</Text></View><Pressable onPress={() => run(() => approveDepartmentRequest(request.id, officer.id), 'Officer approved. Assign them to a squad below.')} style={styles.smallButton}><Text style={styles.smallButtonText}>APPROVE</Text></Pressable></View>
              )) : <Text style={styles.muted}>No pending requests.</Text>}
              <Text style={styles.section}>DEPARTMENT MEMBERS</Text>
              {admin.members.map((member) => (
                <View key={member.id} style={styles.row}>
                  <View style={styles.grow}>
                    <Text style={styles.rowTitle}>{member.name}{member.callSign ? ` · ${member.callSign}` : ''}</Text>
                    <Text style={styles.muted}>{member.unitNumber ? `Unit ${member.unitNumber} · ` : ''}{member.role === 'admin' ? 'Administrator' : 'Member'}</Text>
                  </View>
                  {member.id !== officer.id && member.role !== 'admin' ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${member.name}`} onPress={() => confirmRemoval(member)} style={styles.removeButton}><Text style={styles.removeButtonText}>REMOVE</Text></Pressable> : null}
                </View>
              ))}
              <Text style={styles.section}>CREATE SQUAD</Text>
              <TextInput value={squadName} onChangeText={setSquadName} placeholder="Squad name" placeholderTextColor={colors.muted} style={styles.input} />
              <Pressable onPress={() => run(() => createSquad(workspace.department.id, squadName, officer.id), 'Squad created.')} style={styles.primaryButton}><Text style={styles.primaryText}>CREATE SQUAD</Text></Pressable>
              <Text style={styles.section}>SQUAD ASSIGNMENTS</Text>
              {admin.squads.map((squad) => (
                <View key={squad.id} style={styles.assignment}>
                  <Text style={styles.rowTitle}>{squad.name}</Text>
                  {admin.members.map((member) => {
                    const assigned = squad.memberIds.includes(member.id);
                    return (
                      <View key={member.id} style={styles.squadMemberRow}>
                        <View style={styles.grow}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.muted}>{member.callSign || 'No call sign'}</Text></View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${assigned ? 'Remove' : 'Add'} ${member.name} ${assigned ? 'from' : 'to'} ${squad.name}`}
                          onPress={() => run(
                            () => assigned ? removeSquadMember(squad.id, member.id, officer.id) : assignSquadMember(squad.id, member.id, officer.id),
                            `${member.name} ${assigned ? 'removed from' : 'added to'} ${squad.name}.`,
                          )}
                          style={[styles.squadToggle, assigned && styles.squadToggleAssigned]}
                        >
                          <Text style={[styles.squadToggleText, assigned && styles.squadToggleTextAssigned]}>{assigned ? 'REMOVE' : 'ADD'}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </>
          ) : null}
        </>
      )}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 40, backgroundColor: colors.background },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 42 },
  link: { color: colors.accent, fontWeight: '900' }, signOut: { color: colors.muted, fontWeight: '800' },
  eyebrow: { color: colors.success, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 12 },
  title: { color: colors.text, fontSize: 32, fontWeight: '900', marginTop: 7 },
  pending: { color: colors.warning, fontWeight: '900', marginTop: 14 },
  section: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginTop: 28, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.panel, borderRadius: 10, padding: 13, marginBottom: 7 },
  grow: { flex: 1 }, rowTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, muted: { color: colors.muted, fontSize: 12, marginTop: 3 },
  smallButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 7, backgroundColor: colors.accent, justifyContent: 'center' }, smallButtonText: { color: colors.background, fontSize: 11, fontWeight: '900' },
  removeButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: colors.danger, justifyContent: 'center' }, removeButtonText: { color: colors.danger, fontSize: 10, fontWeight: '900' },
  input: { minHeight: 50, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  primaryButton: { minHeight: 50, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 9 }, primaryText: { color: colors.background, fontWeight: '900' },
  assignment: { backgroundColor: colors.panel, borderRadius: 10, padding: 13, marginBottom: 8 },
  squadMemberRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 10 },
  memberName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  squadToggle: { minWidth: 70, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: colors.accent },
  squadToggleAssigned: { borderWidth: 1, borderColor: colors.danger, backgroundColor: 'transparent' },
  squadToggleText: { color: colors.background, fontSize: 10, fontWeight: '900' },
  squadToggleTextAssigned: { color: colors.danger },
  message: { color: colors.text, backgroundColor: colors.panelRaised, padding: 12, borderRadius: 8, marginTop: 20, textAlign: 'center' },
});
