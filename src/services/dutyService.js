import AsyncStorage from '@react-native-async-storage/async-storage';

export const DUTY_KEY = '@blockwatch/duty-assignment-v2';
const DEFAULT_AVATAR_COLOR = '#059669';
const RESERVED_STATUS_COLORS = new Set(['#2563EB', '#174EA6', '#3478F6', '#FFD54A', '#D97706', '#FF6B6B', '#DC2626', '#B91C2C']);
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
    if (RESERVED_STATUS_COLORS.has(assignment.avatarColor?.toUpperCase())) assignment.avatarColor = DEFAULT_AVATAR_COLOR;
    return assignment;
  } catch {
    return defaultDutyAssignment;
  }
}

export async function saveDutyAssignment(assignment) {
  await AsyncStorage.setItem(DUTY_KEY, JSON.stringify(assignment));
}
