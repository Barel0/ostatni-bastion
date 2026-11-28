package pl.maniacdev.ostatnibastion;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.DisplayCutout;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/* Opakowanie gry: pełny ekran w poziomie, przycisk "Wstecz", wibracje i niegasnący ekran.
   Sama gra to pliki z folderu demo/ dołączone do aplikacji (assets/www). */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF10151D);
        web = new WebView(this);
        web.setBackgroundColor(0xFF10151D);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);
        // przytrzymanie przycisku fali nie może zaznaczać tekstu ani otwierać menu systemu
        web.setLongClickable(false);
        web.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                return true;
            }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                     // zapisy gry i ustawienia
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);                      // pliki z assets działają i bez tego
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);                               // duża czcionka w systemie nie rozsypie układu

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });
        web.addJavascriptInterface(new Bridge(), "BibApp");

        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        // gra nie wchodzi pod otwór na aparat
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                if (Build.VERSION.SDK_INT >= 28) {
                    DisplayCutout c = insets.getDisplayCutout();
                    if (c == null) v.setPadding(0, 0, 0, 0);
                    else v.setPadding(c.getSafeInsetLeft(), c.getSafeInsetTop(), c.getSafeInsetRight(), c.getSafeInsetBottom());
                }
                return insets;
            }
        });
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams p = getWindow().getAttributes();
            p.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(p);
        }
        setContentView(root);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    /* stały pełny ekran: paski systemu chowają się i wracają tylko na chwilę po przesunięciu od krawędzi */
    @SuppressWarnings("deprecation")
    private void immersive() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) immersive();
    }

    /* o tym, co robi "Wstecz", decyduje gra (window.__back); 'exit' zamyka aplikację */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("window.__back ? window.__back() : 'exit'", new android.webkit.ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if ("\"exit\"".equals(value)) finish();
            }
        });
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.__appPause && window.__appPause()", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        immersive();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    private class Bridge {
        /* wzór jak w przeglądarce: "wibracja,przerwa,wibracja..." w milisekundach */
        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void vibrate(String pattern) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator() || pattern == null) return;
            String[] parts = pattern.split(",");
            if (parts.length > 12) return;
            long[] t = new long[parts.length + 1];        // Android zaczyna wzór od przerwy
            try {
                for (int i = 0; i < parts.length; i++) {
                    long ms = Math.min(500, Math.max(0, Long.parseLong(parts[i].trim())));
                    t[i + 1] = i % 2 == 0 ? Math.max(18, ms) : ms;   // bardzo krótkich drgań wiele telefonów nie czuć
                }
            } catch (NumberFormatException e) {
                return;
            }
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(t, -1));
            else v.vibrate(t, -1);
        }

        @JavascriptInterface
        public void keepAwake(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }
    }
}
