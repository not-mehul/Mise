package io.github.notmehul.mise;

import android.content.Intent;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;

/**
 * The home screen's ways into Mise (src/platform/launcher.ts): the icon's
 * shortcuts (res/xml/shortcuts.xml) and the grocery widget (GroceryWidget)
 * open a screen through the "open" extra, and the page keeps the widget's
 * list current with setGroceries.
 */
@CapacitorPlugin(name = "Launcher")
public class LauncherPlugin extends Plugin {

    static final String ACTION_SHORTCUT = "io.github.notmehul.mise.SHORTCUT";
    static final String EXTRA_OPEN = "io.github.notmehul.mise.OPEN";
    static final String READ = "io.github.notmehul.mise.OPEN_READ";

    private String pending;

    @Override
    public void load() {
        Intent intent = getActivity().getIntent();
        if (intent == null || intent.getBooleanExtra(READ, false) || intent.getStringExtra(EXTRA_OPEN) == null) return;
        intent.putExtra(READ, true);
        pending = intent.getStringExtra(EXTRA_OPEN);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        String open = intent == null ? null : intent.getStringExtra(EXTRA_OPEN);
        if (open == null) return;
        if (hasListeners("open")) {
            JSObject event = new JSObject();
            event.put("screen", open);
            notifyListeners("open", event);
        } else {
            pending = open;
        }
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject result = new JSObject();
        if (pending != null) result.put("screen", pending);
        pending = null;
        call.resolve(result);
    }

    /** The items still to buy, for the widget. */
    @PluginMethod
    public void setGroceries(PluginCall call) {
        JSArray items = call.getArray("items", new JSArray());
        JSONArray clean = new JSONArray();
        try {
            for (int i = 0; i < items.length(); i++) clean.put(String.valueOf(items.get(i)));
        } catch (JSONException e) {
            call.reject("items must be a list of text");
            return;
        }
        GroceryWidget.save(getContext(), clean);
        call.resolve();
    }
}
