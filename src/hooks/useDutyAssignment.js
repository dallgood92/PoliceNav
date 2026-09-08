import { useEffect, useState } from 'react';
import { defaultDutyAssignment, loadDutyAssignment, saveDutyAssignment } from '../services/dutyService';

export function useDutyAssignment() {
  const [assignment, setAssignmentState] = useState(defaultDutyAssignment);
  useEffect(() => { loadDutyAssignment().then(setAssignmentState); }, []);
  const setAssignment = async (next) => {
    const value = typeof next === 'function' ? next(assignment) : next;
    setAssignmentState(value);
    await saveDutyAssignment(value);
  };
  return { assignment, setAssignment };
}
