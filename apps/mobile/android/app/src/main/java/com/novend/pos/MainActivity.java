package com.novend.pos;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JsResult;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

public class MainActivity extends BridgeActivity {

    /** Local boot page with auto-nav disabled so Chrome's neterror sheet is never left on screen. */
    private static final String LOCAL_RECOVERY = "https://localhost/?stay=1";
    private static final int REQ_BLUETOOTH_PERMS = 0x4e01;

    private boolean nativeBridgeAttached = false;
    private boolean leavePageBypassInstalled = false;
    private boolean recovering = false;
    private int hostedFailures = 0;
    private boolean mainFrameFailed = false;

    private final AtomicReference<CountDownLatch> bluetoothPermissionLatch =
        new AtomicReference<>(null);
    private final AtomicReference<Boolean> bluetoothPermissionGranted =
        new AtomicReference<>(null);

    public MainActivity() {
        // Official / community plugins load from capacitor.plugins.json.
        // Only Novend-owned plugins need an explicit register.
        registerPlugin(NovendPermissionsPlugin.class);
        registerPlugin(NovendPrintPlugin.class);
        registerPlugin(NovendCameraPlugin.class);
        registerPlugin(NovendBluetoothClassicPlugin.class);
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

    /**
     * In-app Nearby devices / Bluetooth prompt (Android 12+). Blocks the
     * JavascriptInterface binder thread until the system dialog settles —
     * never opens App Info.
     *
     * @return "granted" | "denied"
     */
    public String requestBluetoothPermissionsBlocking() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return "granted";
        }
        boolean connectGranted =
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED;
        boolean scanGranted =
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN)
                == PackageManager.PERMISSION_GRANTED;
        if (connectGranted && scanGranted) {
            return "granted";
        }

        CountDownLatch latch = new CountDownLatch(1);
        bluetoothPermissionLatch.set(latch);
        bluetoothPermissionGranted.set(null);

        List<String> needed = new ArrayList<>();
        if (!connectGranted) {
            needed.add(Manifest.permission.BLUETOOTH_CONNECT);
        }
        if (!scanGranted) {
            needed.add(Manifest.permission.BLUETOOTH_SCAN);
        }
        final String[] permissions = needed.toArray(new String[0]);

        runOnUiThread(
            () ->
                ActivityCompat.requestPermissions(
                    MainActivity.this, permissions, REQ_BLUETOOTH_PERMS
                )
        );

        try {
            if (!latch.await(90, TimeUnit.SECONDS)) {
                return "denied";
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return "denied";
        }

        Boolean granted = bluetoothPermissionGranted.get();
        if (granted != null && granted) {
            return "granted";
        }
        // CONNECT alone is enough to list bonded Classic printers.
        if (
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED
        ) {
            return "granted";
        }
        return "denied";
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        @NonNull String[] permissions,
        @NonNull int[] grantResults
    ) {
        if (requestCode == REQ_BLUETOOTH_PERMS) {
            boolean connectOk = false;
            for (int i = 0; i < permissions.length; i++) {
                if (
                    Manifest.permission.BLUETOOTH_CONNECT.equals(permissions[i])
                        && i < grantResults.length
                        && grantResults[i] == PackageManager.PERMISSION_GRANTED
                ) {
                    connectOk = true;
                }
            }
            boolean allGranted = grantResults.length > 0;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            bluetoothPermissionGranted.set(connectOk || allGranted);
            CountDownLatch latch = bluetoothPermissionLatch.getAndSet(null);
            if (latch != null) {
                latch.countDown();
            }
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
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
                    public void onPageStarted(WebView view, String url, Bitmap favicon) {
                        mainFrameFailed = false;
                        super.onPageStarted(view, url, favicon);
                    }

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (!mainFrameFailed && url != null
                                && !url.contains("stay=1")
                                && !url.contains("error.html")) {
                            hostedFailures = 0;
                            // Cache-first is a one-navigation recovery aid, not
                            // the permanent policy after the connection returns.
                            view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
                        }
                        super.onPageFinished(view, url);
                    }

                    @Override
                    public void onReceivedError(
                            WebView view, WebResourceRequest request, WebResourceError error) {
                        if (shouldRecover(request)) {
                            mainFrameFailed = true;
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
                        if (view != null
                                && shouldRecoverUrl(failingUrl)
                                && failingUrl.equals(view.getUrl())) {
                            mainFrameFailed = true;
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
                view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
                view.loadUrl(LOCAL_RECOVERY);
            } finally {
                recovering = false;
            }
        });
    }
}
