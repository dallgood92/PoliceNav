import AsyncStorage from '@react-native-async-storage/async-storage';

export const DUTY_KEY = '@blockwatch/duty-assignment';
export const defaultDutyAssignment = {
  unitNumber: '47',
  callSign: '875',
  avatarColor: '#2563EB',
  secondOfficer: 'Jeremy Rogers',
  secondOfficerCallSign: '861',
  status: 'available',
};

export async function loadDutyAssignment() {
  const saved = await AsyncStorage.getItem(DUTY_KEY);
  if (!saved) return defaultDutyAssignment;
  try {
    const assignment = { ...defaultDutyAssignment, ...JSON.parse(saved) };
    const callSigns = { 'Jeremy Rogers': '861', 'Trey Humphries': '874', 'Jared Ramm': '869' };
    return { ...assignment, secondOfficerCallSign: assignment.secondOfficer ? callSigns[assignment.secondOfficer] : null };
  }
  catch { return defaultDutyAssignment; }
}

export async function saveDutyAssignment(assignment) {
  await AsyncStorage.setItem(DUTY_KEY, JSON.stringify(assignment));
}
