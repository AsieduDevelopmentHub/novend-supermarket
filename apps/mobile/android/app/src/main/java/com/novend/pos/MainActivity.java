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
                });
    }

    private static boolean shouldRecover(WebResourceRequest request) {
        if (request == null || !request.isForMainFrame() || request.getUrl() == null) {
            return false;
        }
        String url = request.getUrl().toString();
        if (url.contains("stay=1")) {
            return false;
        }
        return url.startsWith("https://") && !url.startsWith("https://localhost");
    }

    private static void loadRecovery(WebView view) {
        if (view == null) {
            return;
        }
        view.post(() -> view.loadUrl(LOCAL_RECOVERY));
    }
}
