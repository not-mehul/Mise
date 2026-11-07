// Timer alarms, so a timer rings with the screen off or with another app
// open. Each is set for the moment the timer ends; Android rings it whether
// or not Mise is running, on the alarm stream and until it is answered
// (TimerAlarmPlugin.java). Opening the alarm brings back cooking mode at the
// step that set it. Nothing on the web: the app rings itself while open.

import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './output';

interface TimerAlarmPlugin {
  prepare(options: { name: string; description: string }): Promise<void>;
  schedule(options: { id: number; at: number; title: string; body: string; recipeId: string; stepId: string; stopLabel: string }): Promise<void>;
  cancel(options: { id: number }): Promise<void>;
  getPending(): Promise<{ opened?: OpenedAlarm }>;
  addListener(event: 'opened', listener: (opened: OpenedAlarm) => void): Promise<{ remove: () => Promise<void> }>;
}

/** An alarm the person opened from the notification. */
export interface OpenedAlarm {
  id: number;
  recipeId: string;
  stepId: string;
}

const TimerAlarm = registerPlugin<TimerAlarmPlugin>('TimerAlarm');
let ready: Promise<boolean> | null = null;

/** Creates the alarm channel and asks to post notifications, once. True when they can be shown. */
export function alarmsReady(channelName: string, channelText: string): Promise<boolean> {
  if (!isNative) return Promise.resolve(false);
  ready ??= (async () => {
    try {
      await TimerAlarm.prepare({ name: channelName, description: channelText });
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

export interface AlarmDetails {
  title: string;
  body: string;
  recipeId: string;
  stepId: string;
  stopLabel: string;
}

export async function scheduleAlarm(id: number, at: number, details: AlarmDetails): Promise<void> {
  if (!isNative) return;
  try {
    await TimerAlarm.schedule({ id, at, ...details });
  } catch (err) {
    console.warn('Scheduling the timer alarm failed:', err);
  }
}

/** Stops a pending alarm, and the ringing if it has started. */
export async function cancelAlarm(id: number): Promise<void> {
  if (!isNative) return;
  await TimerAlarm.cancel({ id }).catch(() => undefined);
  // Timers set before an update were Local Notifications.
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);
  await LocalNotifications.removeDeliveredNotificationsById({ ids: [id] }).catch(() => undefined);
}

/** Calls back when the person opens a timer's alarm, including the one that started Mise. */
export async function listenForAlarms(onOpen: (opened: OpenedAlarm) => void): Promise<void> {
  if (!isNative) return;
  await TimerAlarm.addListener('opened', onOpen);
  const { opened } = await TimerAlarm.getPending().catch(() => ({ opened: undefined }));
  if (opened) onOpen(opened);
}
