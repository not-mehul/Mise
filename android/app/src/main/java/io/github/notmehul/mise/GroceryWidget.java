package io.github.notmehul.mise;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONException;

/**
 * The grocery list on the home screen: what is still to buy, as Mise last
 * saw it (LauncherPlugin.setGroceries keeps it here). Tapping it opens the
 * list in Mise, where items are ticked off.
 */
public class GroceryWidget extends AppWidgetProvider {

    static final String PREFS = "mise.widget";
    static final String ITEMS = "groceries";
    static final int SHOWN = 8;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews views = views(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    /** Saves the list and redraws every grocery widget. */
    static void save(Context context, JSONArray items) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(ITEMS, items.toString()).apply();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, GroceryWidget.class));
        if (ids.length > 0) manager.updateAppWidget(ids, views(context));
    }

    private static RemoteViews views(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.grocery_widget);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray items;
        try {
            items = new JSONArray(prefs.getString(ITEMS, "[]"));
        } catch (JSONException e) {
            items = new JSONArray();
        }
        StringBuilder text = new StringBuilder();
        int shown = Math.min(SHOWN, items.length());
        for (int i = 0; i < shown; i++) {
            if (i > 0) text.append('\n');
            text.append("•  ").append(items.optString(i));
        }
        views.setTextViewText(R.id.widget_items, shown == 0 ? context.getString(R.string.widget_empty) : text.toString());
        int more = items.length() - shown;
        views.setViewVisibility(R.id.widget_more, more > 0 ? View.VISIBLE : View.GONE);
        if (more > 0) views.setTextViewText(R.id.widget_more, context.getString(R.string.widget_more, more));

        Intent open = new Intent(context, MainActivity.class)
            .setAction(LauncherPlugin.ACTION_SHORTCUT)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(LauncherPlugin.EXTRA_OPEN, "groceries");
        views.setOnClickPendingIntent(
            R.id.widget_root,
            PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
        );
        return views;
    }
}
