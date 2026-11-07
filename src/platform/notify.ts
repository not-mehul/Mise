// Timer alarms as system notifications, so a timer rings with the screen off
// or with another app open. Scheduled for the moment the timer ends; Android
// fires it whether or not Mise is running. Nothing on the web.

import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './output';

const CHANNEL = 'timers';
let ready: Promise<boolean> | null = null;

/** Creates the timers channel and asks to post notifications, once. True when they can be shown. */
export function alarmsReady(channelName: string, channelText: string): Promise<boolean> {
  if (!isNative) return Promise.resolve(false);
  ready ??= (async () => {
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL,
        name: channelName,
        description: channelText,
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
      });
      let { display } = await LocalNotifications.checkPermissions();
      if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await LocalNotifications.requestPermissions());
      return display === 'granted';
    } catch (err) {
      console.warn('Notifications unavailable:', err);
      return false;
    }
  })();
  const pending = ready;
  // A refusal is asked again next time, in case it was changed in system settings.
  void pending.then((ok) => {
    if (!ok && ready === pending) ready = null;
  });
  return pending;
}

export async function scheduleAlarm(id: number, title: string, body: string, at: number): Promise<void> {
  if (!isNative) return;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          channelId: CHANNEL,
          smallIcon: 'ic_stat_mise',
          autoCancel: true,
          schedule: { at: new Date(at), allowWhileIdle: true },
        },
      ],
    });
  } catch (err) {
    console.warn('Scheduling the timer alarm failed:', err);
  }
}

/** Stops a pending alarm and clears it from the shade if it already rang. */
export async function cancelAlarm(id: number): Promise<void> {
  if (!isNative) return;
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);
  // cancel() leaves one that has already rung in the shade.
  await LocalNotifications.removeDeliveredNotificationsById({ ids: [id] }).catch(() => undefined);
}
