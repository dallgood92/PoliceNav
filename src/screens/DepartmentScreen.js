import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  approveDepartmentRequest,
  assignSquadMember,
  createDepartment,
  createSquad,
  listDepartments,
  requestDepartmentAccess,
} from '../services/departmentService';
import { colors } from '../theme/colors';

export default function DepartmentScreen({ officer, workspace, refresh, onDone, onSignOut }) {
  const [departments, setDepartments] = useState([]);
  const [departmentName, setDepartmentName] = useState('');
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
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        {workspace?.department ? <Pressable onPress={onDone}><Text style={styles.link}>‹ DASHBOARD</Text></Pressable> : <View />}
        <Pressable onPress={onSignOut}><Text style={styles.signOut}>SIGN OUT</Text></Pressable>
      </View>
      <Text style={styles.eyebrow}>SIGNED IN AS {officer.name.toUpperCase()}</Text>
      <Text style={styles.title}>{workspace?.department?.name || 'Join a department'}</Text>

      {!workspace?.department ? (
        <>
          {workspace?.pendingRequest ? <Text style={styles.pending}>REQUEST PENDING APPROVAL</Text> : null}
          <Text style={styles.section}>AVAILABLE DEPARTMENTS</Text>
          {departments.map((department) => (
            <View key={department.id} style={styles.row}>
              <View style={styles.grow}><Text style={styles.rowTitle}>{department.name}</Text><Text style={styles.muted}>{department.memberCount} members</Text></View>
              <Pressable disabled={Boolean(workspace?.pendingRequest)} onPress={() => run(() => requestDepartmentAccess(department.id, officer.id), 'Request sent to the department admin.')} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>REQUEST</Text>
              </Pressable>
            </View>
          ))}
          {workspace?.canManage ? (
            <>
              <Text style={styles.section}>CREATE A DEPARTMENT</Text>
              <TextInput value={departmentName} onChangeText={setDepartmentName} placeholder="Department name" placeholderTextColor={colors.muted} style={styles.input} />
              <Pressable onPress={() => run(() => createDepartment(departmentName, officer.id), 'Department created.')} style={styles.primaryButton}><Text style={styles.primaryText}>CREATE DEPARTMENT</Text></Pressable>
            </>
          ) : null}
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
              <Text style={styles.section}>CREATE SQUAD</Text>
              <TextInput value={squadName} onChangeText={setSquadName} placeholder="Squad name" placeholderTextColor={colors.muted} style={styles.input} />
              <Pressable onPress={() => run(() => createSquad(workspace.department.id, squadName, officer.id), 'Squad created.')} style={styles.primaryButton}><Text style={styles.primaryText}>CREATE SQUAD</Text></Pressable>
              <Text style={styles.section}>SQUAD ASSIGNMENTS</Text>
              {admin.squads.map((squad) => (
                <View key={squad.id} style={styles.assignment}><Text style={styles.rowTitle}>{squad.name}</Text>{admin.members.filter((member) => !squad.memberIds.includes(member.id)).map((member) => <Pressable key={member.id} onPress={() => run(() => assignSquadMember(squad.id, member.id, officer.id), `${member.name} added to ${squad.name}.`)} style={styles.memberButton}><Text style={styles.memberText}>+ {member.name}</Text></Pressable>)}</View>
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
  input: { minHeight: 50, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  primaryButton: { minHeight: 50, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 9 }, primaryText: { color: colors.background, fontWeight: '900' },
  assignment: { backgroundColor: colors.panel, borderRadius: 10, padding: 13, marginBottom: 8 }, memberButton: { paddingVertical: 9 }, memberText: { color: colors.accent, fontWeight: '800' },
  message: { color: colors.text, backgroundColor: colors.panelRaised, padding: 12, borderRadius: 8, marginTop: 20, textAlign: 'center' },
});
