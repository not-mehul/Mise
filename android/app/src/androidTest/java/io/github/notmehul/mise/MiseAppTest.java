package io.github.notmehul.mise;

import static androidx.test.espresso.web.assertion.WebViewAssertions.webMatches;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.getText;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.hamcrest.Matchers.containsString;

import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.web.webdriver.Locator;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Drives the real app (WebView + native bridge) on a device or emulator:
 * the page loads, the tabs switch, the native plugins are there, and the app survives being recreated
 * (rotation, a theme change, coming back from the background).
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
