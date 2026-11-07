package io.github.notmehul.mise;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;

/**
 * Rings a kitchen timer when its alarm goes off (TimerAlarmPlugin), and
 * stops it from the notification's Stop button. The notification keeps
 * sounding (FLAG_INSISTENT) until it is answered.
 */
public class TimerAlarmReceiver extends BroadcastReceiver {

    static final String ACTION_RING = "io.github.notmehul.mise.TIMER_RING";
    static final String ACTION_STOP = "io.github.notmehul.mise.TIMER_STOP";

    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra(TimerAlarmPlugin.EXTRA_ID, 0);
        if (ACTION_STOP.equals(intent.getAction())) {
            TimerAlarmPlugin.manager(context).cancel(id);
            return;
        }
        if (!ACTION_RING.equals(intent.getAction())) return;
        // The channel normally exists already; this covers a timer set before an update.
        TimerAlarmPlugin.ensureChannel(context, "Timers", "");

        Intent open = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(TimerAlarmPlugin.EXTRA_ID, id)
            .putExtra(TimerAlarmPlugin.EXTRA_RECIPE, intent.getStringExtra(TimerAlarmPlugin.EXTRA_RECIPE))
            .putExtra(TimerAlarmPlugin.EXTRA_STEP, intent.getStringExtra(TimerAlarmPlugin.EXTRA_STEP));
        PendingIntent content = PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stop = new Intent(context, TimerAlarmReceiver.class).setAction(ACTION_STOP).putExtra(TimerAlarmPlugin.EXTRA_ID, id);
        PendingIntent stopping = PendingIntent.getBroadcast(context, id, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String stopLabel = intent.getStringExtra(TimerAlarmPlugin.EXTRA_STOP_LABEL);
        Notification notification = new NotificationCompat.Builder(context, TimerAlarmPlugin.CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_mise)
            .setContentTitle(intent.getStringExtra(TimerAlarmPlugin.EXTRA_TITLE))
            .setContentText(intent.getStringExtra(TimerAlarmPlugin.EXTRA_BODY))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(content)
            .setDeleteIntent(stopping)
            .setAutoCancel(true)
            .addAction(0, stopLabel == null ? "Stop" : stopLabel, stopping)
            .build();
        notification.flags |= Notification.FLAG_INSISTENT;
        try {
            TimerAlarmPlugin.manager(context).notify(id, notification);
        } catch (SecurityException ignored) {
            // Notifications were turned off: Mise rings in the app instead when it is open.
        }
    }
}
