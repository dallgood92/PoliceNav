import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { BACKGROUND_LOCATION_TASK } from '../tasks/backgroundLocationTask';
import { isLocationBackendConfigured } from './locationApi';

export async function backgroundSharingStatus() {
  if (!isLocationBackendConfigured()) return 'unconfigured';
  const available = await TaskManager.isAvailableAsync();
  if (!available) return 'unavailable';
  return (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) ? 'active' : 'stopped';
}

export async function startBackgroundSharing() {
  if (!isLocationBackendConfigured()) {
    throw new Error('Configure the live-location server before enabling sharing.');
  }
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Allow precise location while using the app first.');
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    throw new Error('Choose Always Allow in Location Settings to share while the app is in the background.');
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.AutomotiveNavigation,
    distanceInterval: 5,
    timeInterval: 2000,
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'BlockWatch location sharing',
      notificationBody: 'Your live location is being shared with your partners.',
      notificationColor: '#FFD54A',
    },
  });
}

export async function stopBackgroundSharing() {
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
