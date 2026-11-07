package io.github.notmehul.mise;

import static androidx.test.espresso.web.assertion.WebViewAssertions.webMatches;
import static androidx.test.espresso.web.model.Atoms.castOrDie;
import static androidx.test.espresso.web.model.Atoms.script;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.getText;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.hamcrest.Matchers.containsString;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.net.Uri;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.espresso.web.webdriver.Locator;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Drives the real app (WebView + native bridge) on a device or emulator:
 * the page loads, the tabs switch, the native plugins are there, and the app survives being recreated
 * (rotation, a theme change, coming back from the background). Sharing to
 * Mise opens the review screen, and photos are read offline by ML Kit.
 */
@RunWith(AndroidJUnit4.class)
public class MiseAppTest {

    private static final long TIMEOUT_MS = 30_000;

    @Test
    public void opensEveryTab() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitForText(Locator.CSS_SELECTOR, "#viewRecipes .empty-title", "No recipes yet");
            onWebView().withElement(findElement(Locator.ID, "tabGroceries")).perform(webClick());
            waitForText(Locator.CSS_SELECTOR, "#viewGroceries .empty-title", "Nothing to buy");
            onWebView().withElement(findElement(Locator.ID, "tabSettings")).perform(webClick());
            waitForText(Locator.CSS_SELECTOR, "#viewSettings h2", "Appearance");
            // The switch shows only when MainActivity registered the volume keys plugin.
            waitForText(Locator.CSS_SELECTOR, "#switchVolumeKeys .switch-label", "Volume keys turn steps");

            scenario.recreate();

            // A recreated activity reloads the page, which opens on Recipes.
            // (Tab labels are set in caps by CSS, and getText returns them as shown.)
            waitForText(Locator.CSS_SELECTOR, "#viewRecipes .empty-title", "No recipes yet");
        }
    }

    @Test
    public void sharedTextOpensTheReview() {
        Intent share = new Intent(ApplicationProvider.getApplicationContext(), MainActivity.class)
            .setAction(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, "Chilli oil eggs\nIngredients\n2 eggs\n1 tbsp chilli oil\nMethod\nFry the eggs in the chilli oil for 3 minutes.\nServe on toast with a pinch of salt and some spring onions.");
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(share)) {
            waitForText(Locator.CSS_SELECTOR, "#recipeEditor h2", "Check the recipe");
            waitForValue("editIngredients", "1 tbsp chilli oil");
        }
    }

    @Test
    public void sharedPhotoIsReadOnThePhone() throws IOException {
        Context context = ApplicationProvider.getApplicationContext();
        File photo = new File(context.getCacheDir(), "recipe-card.jpg");
        try (FileOutputStream out = new FileOutputStream(photo)) {
            recipeCard().compress(Bitmap.CompressFormat.JPEG, 92, out);
        }
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", photo);
        Intent share = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_SEND)
            .setType("image/jpeg")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(share)) {
            waitForText(Locator.CSS_SELECTOR, "#recipeEditor h2", "Check the recipe");
            waitForValue("editIngredients", "eggs");
        } finally {
            photo.delete();
        }
    }

    /** A plain recipe card: black type on white, large enough to read. */
    private static Bitmap recipeCard() {
        String[] lines = { "Scrambled eggs", "Ingredients", "3 eggs", "1 tbsp butter", "Method", "Melt the butter.", "Stir in the eggs." };
        Bitmap bitmap = Bitmap.createBitmap(1200, 1400, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);
        paint.setTextSize(72);
        paint.setTypeface(Typeface.SANS_SERIF);
        for (int i = 0; i < lines.length; i++) canvas.drawText(lines[i], 80, 160 + i * 170, paint);
        return bitmap;
    }

    /** Polls until the form field with this id holds `expected` (a field's value isn't its text). */
    private static void waitForValue(String id, String expected) {
        long deadline = System.currentTimeMillis() + TIMEOUT_MS;
        String last = null;
        while (System.currentTimeMillis() < deadline) {
            try {
                last = onWebView().perform(script("var e = document.getElementById('" + id + "'); return e ? e.value : '';", castOrDie(String.class))).get();
                if (last != null && last.contains(expected)) return;
            } catch (RuntimeException ignored) {
                // The page is still loading.
            }
            try {
                Thread.sleep(250);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new AssertionError(interrupted);
            }
        }
        throw new AssertionError("#" + id + " never held \"" + expected + "\"; last value: " + last);
    }

    /** Polls until the element exists and its text contains `expected`. */
    private static void waitForText(Locator by, String selector, String expected) {
        long deadline = System.currentTimeMillis() + TIMEOUT_MS;
        AssertionError last = null;
        while (System.currentTimeMillis() < deadline) {
            try {
                onWebView().withElement(findElement(by, selector)).check(webMatches(getText(), containsString(expected)));
                return;
            } catch (RuntimeException | AssertionError e) {
                last = e instanceof AssertionError ? (AssertionError) e : new AssertionError(e);
                try {
                    Thread.sleep(250);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new AssertionError(interrupted);
                }
            }
        }
        throw last != null ? last : new AssertionError("Timed out waiting for " + selector);
    }
}
