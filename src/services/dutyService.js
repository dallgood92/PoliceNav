import AsyncStorage from '@react-native-async-storage/async-storage';

export const DUTY_KEY = '@blockwatch/duty-assignment-v2';
const DEFAULT_AVATAR_COLOR = '#059669';
export const defaultDutyAssignment = {
  unitNumber: '',
  callSign: '',
  avatarColor: DEFAULT_AVATAR_COLOR,
  secondOfficer: null,
  secondOfficerCallSign: null,
  status: 'available',
};

export async function loadDutyAssignment() {
  const saved = await AsyncStorage.getItem(DUTY_KEY);
  if (!saved) return defaultDutyAssignment;
  try {
    const assignment = { ...defaultDutyAssignment, ...JSON.parse(saved) };
    assignment.avatarColor = DEFAULT_AVATAR_COLOR;
    return assignment;
  } catch {
    return defaultDutyAssignment;
  }
}

export async function saveDutyAssignment(assignment) {
  await AsyncStorage.setItem(DUTY_KEY, JSON.stringify(assignment));
}
