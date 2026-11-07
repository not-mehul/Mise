package io.github.notmehul.mise;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Kitchen timers that ring like an alarm (src/platform/notify.ts): at the
 * moment a timer ends, AlarmManager wakes TimerAlarmReceiver, which posts a
 * notification on the alarm sound stream that keeps ringing until Stop is
 * pressed, the timer is cleared in Mise, or the notification is opened.
 * Opening it brings Mise back to cooking mode at the step that set it,
 * through the "opened" event.
 */
@CapacitorPlugin(name = "TimerAlarm")
public class TimerAlarmPlugin extends Plugin {

    static final String CHANNEL = "timer-alarms";
    /** The channel Local Notifications rang timers on before this plugin. */
    static final String OLD_CHANNEL = "timers";

    static final String EXTRA_ID = "io.github.notmehul.mise.TIMER_ID";
    static final String EXTRA_TITLE = "io.github.notmehul.mise.TIMER_TITLE";
    static final String EXTRA_BODY = "io.github.notmehul.mise.TIMER_BODY";
    static final String EXTRA_RECIPE = "io.github.notmehul.mise.TIMER_RECIPE";
    static final String EXTRA_STEP = "io.github.notmehul.mise.TIMER_STEP";
    static final String EXTRA_STOP_LABEL = "io.github.notmehul.mise.TIMER_STOP_LABEL";
    /** Marks a launch intent as read, like ShareIntakePlugin.READ. */
    static final String READ = "io.github.notmehul.mise.TIMER_READ";

    private JSObject pending;

    @Override
    public void load() {
        Intent intent = getActivity().getIntent();
        if (intent == null || intent.getBooleanExtra(READ, false) || !intent.hasExtra(EXTRA_RECIPE)) return;
        intent.putExtra(READ, true);
        pending = opened(intent);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (intent == null || !intent.hasExtra(EXTRA_RECIPE)) return;
        JSObject event = opened(intent);
        if (hasListeners("opened")) notifyListeners("opened", event);
        else pending = event;
    }

    private JSObject opened(Intent intent) {
        int id = intent.getIntExtra(EXTRA_ID, 0);
        // Opening it is answering it: the ringing stops.
        manager(getContext()).cancel(id);
        JSObject event = new JSObject();
        event.put("id", id);
        event.put("recipeId", intent.getStringExtra(EXTRA_RECIPE));
        event.put("stepId", intent.getStringExtra(EXTRA_STEP));
        return event;
    }

    /** The timer that opened Mise, if one did and nothing has read it yet. */
    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject result = new JSObject();
        if (pending != null) result.put("opened", pending);
        pending = null;
        call.resolve(result);
    }

    /** Creates the alarm channel, in the person's language. */
    @PluginMethod
    public void prepare(PluginCall call) {
        ensureChannel(getContext(), call.getString("name", "Timers"), call.getString("description", ""));
        call.resolve();
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        Long at = call.getLong("at");
        String recipeId = call.getString("recipeId");
        if (id == null || at == null || recipeId == null) {
            call.reject("id, at and recipeId are needed");
            return;
        }
        Context context = getContext();
        Intent ring = new Intent(context, TimerAlarmReceiver.class)
            .setAction(TimerAlarmReceiver.ACTION_RING)
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_TITLE, call.getString("title", "Mise"))
            .putExtra(EXTRA_BODY, call.getString("body", ""))
            .putExtra(EXTRA_RECIPE, recipeId)
            .putExtra(EXTRA_STEP, call.getString("stepId", ""))
            .putExtra(EXTRA_STOP_LABEL, call.getString("stopLabel", "Stop"));
        PendingIntent operation = PendingIntent.getBroadcast(context, id, ring, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation);
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation);
        }
        call.resolve();
    }

    /** Stops a timer's alarm: the pending one, and the ringing if it has started. */
    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id is needed");
            return;
        }
        cancel(getContext(), id);
        call.resolve();
    }

    static void cancel(Context context, int id) {
        Intent ring = new Intent(context, TimerAlarmReceiver.class).setAction(TimerAlarmReceiver.ACTION_RING);
        PendingIntent operation = PendingIntent.getBroadcast(context, id, ring, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (operation != null) {
            ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(operation);
            operation.cancel();
        }
        manager(context).cancel(id);
    }

    static NotificationManager manager(Context context) {
        return (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    /** A high-importance channel that rings on the alarm stream, so it sounds with media muted. */
    static void ensureChannel(Context context, String name, String description) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = manager(context);
        if (nm.getNotificationChannel(OLD_CHANNEL) != null) nm.deleteNotificationChannel(OLD_CHANNEL);
        NotificationChannel channel = nm.getNotificationChannel(CHANNEL);
        if (channel == null) {
            channel = new NotificationChannel(CHANNEL, name, NotificationManager.IMPORTANCE_HIGH);
            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            channel.setSound(sound, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[] { 0, 600, 400, 600 });
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        } else {
            channel.setName(name);
        }
        channel.setDescription(description);
        nm.createNotificationChannel(channel);
    }
}
