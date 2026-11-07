package io.github.notmehul.mise;

import android.os.Bundle;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

/**
 * Capacitor shell for Mise. mise:// links arrive as VIEW intents
 * (AndroidManifest.xml), which the App plugin passes to the page
 * (src/platform/incoming.ts). Links and photos shared from other apps
 * arrive as SEND intents (ShareIntakePlugin), and photos are read on the
 * phone (TextRecognitionPlugin). In cooking mode the volume keys move between
 * steps while the setting is on (VolumeKeysPlugin, src/platform/device.ts).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VolumeKeysPlugin.class);
        registerPlugin(TextRecognitionPlugin.class);
        registerPlugin(ShareIntakePlugin.class);
        registerPlugin(FolderSyncPlugin.class);
        registerPlugin(TimerAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        if (code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN) {
            VolumeKeysPlugin plugin = volumeKeys();
            if (plugin != null && plugin.isEnabled()) {
                if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) plugin.press(code == KeyEvent.KEYCODE_VOLUME_DOWN ? "down" : "up");
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private VolumeKeysPlugin volumeKeys() {
        if (getBridge() == null) return null;
        PluginHandle handle = getBridge().getPlugin("VolumeKeys");
        return handle == null ? null : (VolumeKeysPlugin) handle.getInstance();
    }
}
