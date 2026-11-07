package io.github.notmehul.mise;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Reads the text in a photo of a recipe, on the phone. ML Kit's Latin
 * model is bundled in the APK, so it works offline and nothing is sent
 * anywhere. The page hands over an upright JPEG (src/platform/ocr.ts) and
 * gets back the text blocks with their boxes, which it puts in reading
 * order itself.
 */
@CapacitorPlugin(name = "TextRecognition")
public class TextRecognitionPlugin extends Plugin {

    private TextRecognizer recognizer;

    @Override
    public void load() {
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    }

    @Override
    protected void handleOnDestroy() {
        if (recognizer != null) recognizer.close();
    }

    @PluginMethod
    public void read(PluginCall call) {
        String data = call.getString("image");
        if (data == null || data.isEmpty()) {
            call.reject("No image");
            return;
        }
        Bitmap bitmap;
        try {
            int comma = data.indexOf(',');
            byte[] bytes = Base64.decode(comma >= 0 ? data.substring(comma + 1) : data, Base64.DEFAULT);
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException e) {
            call.reject("Not an image", e);
            return;
        }
        if (bitmap == null) {
            call.reject("Not an image");
            return;
        }
        final int width = bitmap.getWidth();
        final int height = bitmap.getHeight();
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener(text -> {
                JSArray blocks = new JSArray();
                for (Text.TextBlock block : text.getTextBlocks()) {
                    JSArray lines = new JSArray();
                    for (Text.Line line : block.getLines()) lines.put(line.getText());
                    JSObject out = new JSObject();
                    out.put("lines", lines);
                    Rect box = block.getBoundingBox();
                    if (box != null) {
                        out.put("x", box.left);
                        out.put("y", box.top);
                        out.put("w", box.width());
                        out.put("h", box.height());
                    }
                    blocks.put(out);
                }
                JSObject result = new JSObject();
                result.put("width", width);
                result.put("height", height);
                result.put("blocks", blocks);
                call.resolve(result);
            })
            .addOnFailureListener(e -> call.reject("Reading the photo failed", e));
    }
}
