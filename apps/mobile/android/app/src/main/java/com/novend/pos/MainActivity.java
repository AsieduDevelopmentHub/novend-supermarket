package com.novend.pos;

import android.os.Bundle;
import android.webkit.JsResult;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    /** Local boot page with auto-nav disabled so Chrome's neterror sheet is never left on screen. */
    private static final String LOCAL_RECOVERY = "https://localhost/?stay=1";

    private boolean nativeBridgeAttached = false;
    private boolean leavePageBypassInstalled = false;
    private boolean recovering = false;
    private int hostedFailures = 0;

    public MainActivity() {
        // Official / community plugins load from capacitor.plugins.json.
        // Only Novend-owned plugins need an explicit register.
        registerPlugin(NovendPermissionsPlugin.class);
        registerPlugin(NovendPrintPlugin.class);
        registerPlugin(NovendCameraPlugin.class);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        attachNativeBridge();
        installLeavePageBypass();
        installErrorRecovery();
    }

    @Override
    public void onStart() {
        super.onStart();
        attachNativeBridge();
        installLeavePageBypass();
        installErrorRecovery();
    }

    private void attachNativeBridge() {
        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        WebView webView = this.bridge.getWebView();
        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        if (!nativeBridgeAttached) {
            webView.addJavascriptInterface(new NovendNativeBridge(this), "NovendNative");
            nativeBridgeAttached = true;
        }
    }

    /**
     * Login uses location.replace after the user typed credentials. Android's
     * default WebChromeClient then shows Stay / Leave. Always leave — this is
     * an in-app navigation, not a lost-form warning the cashier can act on.
     */
    private void installLeavePageBypass() {
        if (leavePageBypassInstalled || this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        this.bridge.getWebView().setWebChromeClient(
                new BridgeWebChromeClient(this.bridge) {
                    @Override
                    public boolean onJsBeforeUnload(
                            WebView view, String url, String message, JsResult result) {
                        result.confirm();
                        return true;
                    }
                });
        leavePageBypassInstalled = true;
    }

    private void installErrorRecovery() {
        if (this.bridge == null) {
            return;
        }
        this.bridge.setWebViewClient(
                new BridgeWebViewClient(this.bridge) {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (url != null
                                && !url.contains("stay=1")
                                && !url.contains("error.html")) {
                            hostedFailures = 0;
                        }
                        super.onPageFinished(view, url);
                    }

                    @Override
                    public void onReceivedError(
                            WebView view, WebResourceRequest request, WebResourceError error) {
                        if (shouldRecover(request)) {
                            loadRecovery(view, request.getUrl() != null
                                    ? request.getUrl().toString()
                                    : null);
                            return;
                        }
                        super.onReceivedError(view, request, error);
                    }

                    @Override
                    @SuppressWarnings("deprecation")
                    public void onReceivedError(
                            WebView view, int errorCode, String description, String failingUrl) {
                        if (shouldRecoverUrl(failingUrl)) {
                            loadRecovery(view, failingUrl);
                            return;
                        }
                        super.onReceivedError(view, errorCode, description, failingUrl);
                    }
                });
    }

    private static boolean shouldRecover(WebResourceRequest request) {
        if (request == null || !request.isForMainFrame() || request.getUrl() == null) {
            return false;
        }
        return shouldRecoverUrl(request.getUrl().toString());
    }

    private static boolean shouldRecoverUrl(String url) {
        if (url == null || url.isEmpty()) {
            return false;
        }
        if (url.contains("stay=1") || url.contains("error.html")) {
            return false;
        }
        if (url.startsWith("https://localhost")) {
            return false;
        }
        return url.startsWith("https://") || url.startsWith("http://");
    }

    /**
     * Real-device airplane-mode cold start often fires onReceivedError before the
     * hosted service worker is running. Retry once with cache-else-network so a
     * previously opened workspace can load; only then fall back to stay=1.
     */
    private void loadRecovery(WebView view, String failingUrl) {
        if (view == null || recovering) {
            return;
        }
        recovering = true;
        hostedFailures += 1;
        if (hostedFailures <= 1 && failingUrl != null && !failingUrl.contains("localhost")) {
            view.postDelayed(
                    () -> {
                        try {
                            view.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
                            view.loadUrl(failingUrl);
                        } finally {
                            recovering = false;
                        }
                    },
                    400);
            return;
        }
        hostedFailures = 0;
        view.post(() -> {
            try {
                view.loadUrl(LOCAL_RECOVERY);
            } finally {
                recovering = false;
            }
        });
    }
}
