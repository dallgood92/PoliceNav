import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { createNavigationWatch, getLatestPartner, registerPushToken } from './locationApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureAlertAudio() {
  if (Device.osName === 'Android') {
    await Notifications.setNotificationChannelAsync('cover-alerts-v2', {
      name: 'Cover alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'cover_alert.wav',
      vibrationPattern: [0, 500, 150, 500, 150, 800],
      enableVibrate: true,
    });
  }
}

async function pushToken() {
  if (!Device.isDevice) throw new Error('Push alerts require a physical phone.');
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Notification permission was not granted.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('EAS project ID is missing.');
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function registerForCoverAlerts() {
  const token = await pushToken();
  await registerPushToken(token);
}

export async function armMovingPartnerAlert(partner, provider) {
  const token = await pushToken();
  await registerPushToken(token);
  await createNavigationWatch(partner.id, partner.location, provider);
}

async function handleDirectionsNotification(notification, onOpenDirections) {
  const data = notification?.request?.content?.data;
  if (!['refresh-partner-directions', 'cover-request', 'pursuit'].includes(data?.type) || !data.partnerId) return;
  let partner = {
    id: data.partnerId,
    name: data.partnerName || 'Partner',
    unit: data.partnerUnit || '',
    location: { latitude: Number(data.latitude), longitude: Number(data.longitude) },
  };
  try {
    partner = await getLatestPartner(data.partnerId);
  } catch {
    // Fall back to the coordinates included in the notification.
  }
  if (Number.isFinite(partner.location?.latitude) && Number.isFinite(partner.location?.longitude)) {
    await onOpenDirections(partner);
  }
}

export function observeDirectionNotifications(onOpenDirections) {
  let lastHandledId = null;
  const handle = async (response) => {
    const identifier = response?.notification?.request?.identifier;
    if (!identifier || identifier === lastHandledId) return;
    lastHandledId = identifier;
    await handleDirectionsNotification(response.notification, onOpenDirections);
    Notifications.clearLastNotificationResponse();
  };

  const initial = Notifications.getLastNotificationResponse();
  if (initial) void handle(initial);
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
