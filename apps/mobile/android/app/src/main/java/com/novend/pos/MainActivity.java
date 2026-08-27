package com.novend.pos;

import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    /** Local boot page with auto-nav disabled so Chrome's neterror sheet is never left on screen. */
    private static final String LOCAL_RECOVERY = "https://localhost/?stay=1";

    public MainActivity() {
        registerPlugin(NovendPermissionsPlugin.class);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        installErrorRecovery();
    }

    @Override
    public void onStart() {
        super.onStart();
        // Capacitor may replace the WebViewClient after onCreate — re-install.
        installErrorRecovery();
    }

    private void installErrorRecovery() {
        if (this.bridge == null) {
            return;
        }
        this.bridge.setWebViewClient(
                new BridgeWebViewClient(this.bridge) {
                    @Override
                    public void onReceivedError(
                            WebView view, WebResourceRequest request, WebResourceError error) {
                        if (shouldRecover(request)) {
                            loadRecovery(view);
                            return;
                        }
                        super.onReceivedError(view, request, error);
                    }

                    @Override
                    @SuppressWarnings("deprecation")
                    public void onReceivedError(
                            WebView view, int errorCode, String description, String failingUrl) {
                        if (shouldRecoverUrl(failingUrl)) {
                            loadRecovery(view);
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

    private static void loadRecovery(WebView view) {
        if (view == null) {
            return;
        }
        view.post(() -> view.loadUrl(LOCAL_RECOVERY));
    }
}
