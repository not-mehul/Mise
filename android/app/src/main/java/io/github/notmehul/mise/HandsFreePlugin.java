package io.github.notmehul.mise;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/**
 * Hands-free cooking (src/platform/voice.ts): while cooking mode is open and
 * the setting is on, Android's speech recognizer listens for a few words
 * ("next", "back", "repeat", "timer") and sends what it heard as "heard"
 * events. It listens again after each phrase, on the device where it can.
 * The microphone is asked for the first time hands-free starts.
 */
@CapacitorPlugin(name = "HandsFree", permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") })
public class HandsFreePlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private String lang = "en";
    private boolean listening = false;

    @PluginMethod
    public void start(PluginCall call) {
        lang = call.getString("lang", "en");
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphoneAnswered");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void microphoneAnswered(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) begin(call);
        else resolve(call, false);
    }

    private void begin(PluginCall call) {
        main.post(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                resolve(call, false);
                return;
            }
            listening = true;
            if (recognizer == null) {
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new Listener());
            }
            listenOnce();
            resolve(call, true);
        });
    }

    private static void resolve(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(this::shutdown);
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        // Never listen with Mise in the background.
        main.post(() -> {
            if (recognizer != null) recognizer.cancel();
        });
    }

    @Override
    protected void handleOnResume() {
        main.post(() -> {
            if (listening && recognizer != null) listenOnce();
        });
    }

    @Override
    protected void handleOnDestroy() {
        main.post(this::shutdown);
    }

    private void shutdown() {
        listening = false;
        main.removeCallbacksAndMessages(null);
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
    }

    private void listenOnce() {
        if (!listening || recognizer == null) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            .putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        try {
            recognizer.startListening(intent);
        } catch (RuntimeException e) {
            again(1000);
        }
    }

    private void again(long delay) {
        main.removeCallbacksAndMessages(null);
        main.postDelayed(this::listenOnce, delay);
    }

    private class Listener implements RecognitionListener {

        @Override
        public void onResults(Bundle results) {
            ArrayList<String> texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (texts != null && !texts.isEmpty()) {
                JSObject event = new JSObject();
                event.put("texts", new JSArray(texts));
                notifyListeners("heard", event);
            }
            again(150);
        }

        @Override
        public void onError(int error) {
            if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                listening = false;
                return;
            }
            // Silence or a phrase it couldn't make out: listen again, a little later when it is busy.
            again(error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT ? 1000 : 250);
        }

        @Override
        public void onReadyForSpeech(Bundle params) {}

        @Override
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onPartialResults(Bundle partialResults) {}

        @Override
        public void onEvent(int eventType, Bundle params) {}
    }
}
