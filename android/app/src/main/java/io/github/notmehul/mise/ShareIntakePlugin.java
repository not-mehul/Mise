package io.github.notmehul.mise;

import android.content.ContentResolver;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * "Share to Mise" from other apps: a link or caption (SEND text/plain), one
 * photo (SEND image/*) or several (SEND_MULTIPLE image/*). The share waits
 * here until the page asks for it (getPending), and later shares while Mise
 * is open are sent as a "shared" event. Photos are scaled down and turned
 * upright here, because content:// files can't be read from the page.
 * Nothing is saved: the page opens the import review (src/platform/shared.ts).
 */
@CapacitorPlugin(name = "ShareIntake")
public class ShareIntakePlugin extends Plugin {

    static final int MAX_IMAGES = 10;
    static final int MAX_SIDE = 2000;

    /** Marks a launch intent as read. An extra, not a changed action, so the intent still matches what launched it. */
    static final String READ = "io.github.notmehul.mise.SHARE_READ";

    /** Photos are decoded here, off the main thread, so a share of ten large photos can't freeze the app. */
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    /** Only touched on the worker thread, which runs reads and getPending in the order they arrive. */
    private JSObject pending;

    @Override
    public void load() {
        Intent intent = getActivity().getIntent();
        // Read once: a recreated activity must not import it again.
        if (intent == null || intent.getBooleanExtra(READ, false) || !isShare(intent)) return;
        intent.putExtra(READ, true);
        final Intent shared = new Intent(intent);
        worker.execute(() -> {
            JSObject share = read(shared);
            if (share != null) pending = share;
        });
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (!isShare(intent)) return;
        final Intent shared = new Intent(intent);
        worker.execute(() -> {
            JSObject share = read(shared);
            if (share == null) return;
            if (hasListeners("shared")) notifyListeners("shared", share);
            else pending = share;
        });
    }

    @Override
    protected void handleOnDestroy() {
        worker.shutdown();
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        worker.execute(() -> {
            JSObject result = new JSObject();
            if (pending != null) result.put("share", pending);
            pending = null;
            call.resolve(result);
        });
    }

    private static boolean isShare(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        return Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action);
    }

    private JSObject read(Intent intent) {
        if (intent == null) return null;
        String action = intent.getAction();
        String type = intent.getType();
        if (type == null || !(Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action))) return null;
        JSObject share = new JSObject();
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (text != null) share.put("text", text);
        if (subject != null) share.put("subject", subject);
        if (type.startsWith("image/")) {
            JSArray images = new JSArray();
            for (Uri uri : uris(intent, action)) {
                if (images.length() >= MAX_IMAGES) break;
                String jpeg = jpeg(uri);
                if (jpeg != null) images.put(jpeg);
            }
            share.put("images", images);
            if (images.length() == 0 && text == null) return null;
        } else if (text == null) {
            return null;
        }
        return share;
    }

    @SuppressWarnings("deprecation")
    private List<Uri> uris(Intent intent, String action) {
        List<Uri> out = new ArrayList<>();
        if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = Build.VERSION.SDK_INT >= 33
                ? intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class)
                : intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) out.addAll(list);
        } else {
            Uri uri = Build.VERSION.SDK_INT >= 33
                ? intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class)
                : intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri != null) out.add(uri);
        }
        return out;
    }

    /** The photo as an upright JPEG no longer than MAX_SIDE, base64, or null. */
    private String jpeg(Uri uri) {
        ContentResolver resolver = getContext().getContentResolver();
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            try (InputStream in = resolver.openInputStream(uri)) {
                BitmapFactory.decodeStream(in, null, bounds);
            }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = 1;
            while (Math.max(bounds.outWidth, bounds.outHeight) / (options.inSampleSize * 2) >= MAX_SIDE) options.inSampleSize *= 2;
            Bitmap bitmap;
            try (InputStream in = resolver.openInputStream(uri)) {
                bitmap = BitmapFactory.decodeStream(in, null, options);
            }
            if (bitmap == null) return null;
            int rotation = 0;
            try (InputStream in = resolver.openInputStream(uri)) {
                if (in != null) rotation = new ExifInterface(in).getRotationDegrees();
            } catch (IOException ignored) {
                // No EXIF: leave it as it is.
            }
            float scale = Math.min(1f, (float) MAX_SIDE / Math.max(bitmap.getWidth(), bitmap.getHeight()));
            if (rotation != 0 || scale < 1f) {
                Matrix matrix = new Matrix();
                matrix.postScale(scale, scale);
                matrix.postRotate(rotation);
                Bitmap turned = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
                if (turned != bitmap) bitmap.recycle();
                bitmap = turned;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 88, out);
            bitmap.recycle();
            return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (IOException | SecurityException | OutOfMemoryError e) {
            Logger.warn("ShareIntake", "Could not read a shared photo: " + e.getMessage());
            return null;
        }
    }
}
