import * as Notifications from 'expo-notifications';
import { LogBox, Platform } from 'react-native';

// Hide Expo Go's informational remote-push notice (this app only uses local notifications)
LogBox.ignoreLogs([
  'Push notifications (remote notifications) are unavailable in Expo Go',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

const DAILY_DRILL_NOTIFICATION_ID = 'daily-calculus-drill-reminder';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests local notification permissions and sets up Android channel on app launch.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('daily-drill', {
          name: 'Daily Calculus Drill',
          importance: Notifications.AndroidImportance.HIGH,
        });
      } catch {
        // Ignore channel creation error inside Expo Go sandbox; default channel is used automatically
      }
    }

    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedules a recurring daily local notification at the specified hour and minute (default 07:00 AM).
 * Cancels any previously scheduled daily drill notifications before scheduling the updated one.
 */
export async function scheduleDailyDrillNotification(params: {
  currentLevel: number;
  hour?: number;
  minute?: number;
}): Promise<string | null> {
  const { currentLevel, hour = 7, minute = 0 } = params;

  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    // Clear existing scheduled daily notifications to keep a single clean schedule
    await Notifications.cancelAllScheduledNotificationsAsync();

    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: DAILY_DRILL_NOTIFICATION_ID,
      content: {
        title: 'Daily Calculus Drill 📐',
        body: `Level ${currentLevel} is ready! Solve today's calculus puzzle to level up.`,
        sound: true,
        data: {
          screen: 'DailyDrill',
          level: currentLevel,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    return identifier;
  } catch {
    return null;
  }
}

/**
 * Fires an immediate preview notification for testing from the Settings screen.
 */
export async function sendTestDrillNotification(currentLevel: number): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Calculus Drill 📐',
        body: `Level ${currentLevel} is ready! Solve today's calculus puzzle to level up.`,
        sound: true,
        data: {
          screen: 'DailyDrill',
          level: currentLevel,
        },
      },
      trigger: null,
    });
  } catch {
    // No-op if blocked by OS
  }
}

/**
 * Formats 24-hour (hour, minute) into a readable 12-hour string, e.g., "07:00 AM".
 */
export function formatNotificationTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const paddedHour = String(hour12).padStart(2, '0');
  const paddedMin = String(minute).padStart(2, '0');
  return `${paddedHour}:${paddedMin} ${period}`;
}
