import * as TaskManager from 'expo-task-manager';
import { publishLocation } from '../services/locationApi';

export const BACKGROUND_LOCATION_TASK = 'blockwatch-background-location';

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const latest = data.locations[data.locations.length - 1];
    try {
      await publishLocation(latest);
    } catch {
      // The most recent unsent fix is retained locally. A later update retries.
    }
  });
}
