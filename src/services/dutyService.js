import AsyncStorage from '@react-native-async-storage/async-storage';

export const DUTY_KEY = '@blockwatch/duty-assignment-v2';
export const defaultDutyAssignment = {
  unitNumber: '',
  callSign: '',
  avatarColor: '#2563EB',
  secondOfficer: null,
  secondOfficerCallSign: null,
  status: 'available',
};

export async function loadDutyAssignment() {
  const saved = await AsyncStorage.getItem(DUTY_KEY);
  if (!saved) return defaultDutyAssignment;
  try {
    return { ...defaultDutyAssignment, ...JSON.parse(saved) };
  } catch {
    return defaultDutyAssignment;
  }
}

export async function saveDutyAssignment(assignment) {
  await AsyncStorage.setItem(DUTY_KEY, JSON.stringify(assignment));
}
