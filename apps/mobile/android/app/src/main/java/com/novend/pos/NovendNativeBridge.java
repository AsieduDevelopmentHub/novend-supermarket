package com.novend.pos;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.fragment.app.FragmentActivity;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/**
 * WebView JavascriptInterface — not the Capacitor plugin bridge.
 * After the hosted origin loads, official Cap plugins often hang; this channel
 * still writes Downloads and opens the system share sheet.
 */
public class NovendNativeBridge {

    private final Activity activity;
    private final Context context;
    private final Object lock = new Object();
    private ByteArrayOutputStream pending;
    private String pendingName;
    private String pendingMime;

    public NovendNativeBridge(Activity activity) {
        this.activity = activity;
        this.context = activity.getApplicationContext();
    }

    @JavascriptInterface
    public void beginSave(String fileName, String mimeType) {
        synchronized (lock) {
            pending = new ByteArrayOutputStream();
            pendingName = sanitizeFileName(fileName);
            pendingMime =
                mimeType != null && !mimeType.isEmpty()
                    ? mimeType
                    : "application/octet-stream";
        }
    }

    @JavascriptInterface
    public void appendChunk(String base64) {
        if (base64 == null || base64.isEmpty()) {
            return;
        }
        synchronized (lock) {
            if (pending == null) {
                return;
            }
            try {
                byte[] chunk = Base64.decode(base64, Base64.DEFAULT);
                pending.write(chunk, 0, chunk.length);
            } catch (IllegalArgumentException ignored) {
                pending = null;
                pendingName = null;
                pendingMime = null;
            }
        }
    }

    @JavascriptInterface
    public boolean finishSave() {
        PendingFile file = takePending();
        if (file == null) {
            return false;
        }
        try {
            writeDownloads(file.name, file.mime, file.bytes);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean finishShare() {
        PendingFile file = takePending();
        if (file == null) {
            return false;
        }
        try {
            File cache = new File(context.getCacheDir(), file.name);
            try (OutputStream out = new FileOutputStream(cache)) {
                out.write(file.bytes);
            }
            Uri uri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                cache
            );
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType(file.mime);
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.putExtra(Intent.EXTRA_SUBJECT, file.name);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.runOnUiThread(
                () -> activity.startActivity(Intent.createChooser(share, file.name))
            );
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    /** Real Android notification state — never a Capacitor plugin call. */
    @JavascriptInterface
    public String notificationState() {
        boolean channelEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT >= 33) {
            boolean granted =
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
            return granted && channelEnabled ? "granted" : "denied";
        }
        return channelEnabled ? "granted" : "denied";
    }

    @JavascriptInterface
    public boolean openNotificationSettings() {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", context.getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    /**
     * JSON: available, supported, enrolled, type. Uses BiometricManager so
     * Settings Check works after the hosted origin (Cap plugins hang).
     */
    @JavascriptInterface
    public String biometricStatus() {
        JSONObject out = new JSONObject();
        try {
            BiometricManager manager = BiometricManager.from(context);
            int can =
                manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
            boolean success = can == BiometricManager.BIOMETRIC_SUCCESS;
            boolean noneEnrolled = can == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED;
            boolean supported = success || noneEnrolled;
            String type = "none";
            if (supported) {
                if (Build.VERSION.SDK_INT >= 29
                    && context
                        .getPackageManager()
                        .hasSystemFeature(PackageManager.FEATURE_FACE)) {
                    type = "face";
                } else if (context
                    .getPackageManager()
                    .hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)) {
                    type = "fingerprint";
                } else {
                    type = "unknown";
                }
            }
            String reason = "";
            if (noneEnrolled) {
                reason = "Add a fingerprint or face unlock in Android settings, then return.";
            } else if (!supported) {
                reason = "This device does not support fingerprint or face unlock.";
            }
            out.put("available", success);
            out.put("supported", supported);
            out.put("enrolled", success);
            out.put("type", type);
            out.put("reason", reason);
        } catch (Exception error) {
            try {
                out.put("available", false);
                out.put("supported", false);
                out.put("enrolled", false);
                out.put("type", "none");
            } catch (Exception ignored) {
                return "{\"available\":false,\"supported\":false,\"enrolled\":false,\"type\":\"none\"}";
            }
        }
        return out.toString();
    }

    /** Blocks the WebView binder thread until the system prompt settles. */
    @JavascriptInterface
    public String authenticateBiometric(String reason) {
        if (!(activity instanceof FragmentActivity)) {
            return "error";
        }
        final CountDownLatch latch = new CountDownLatch(1);
        final String[] outcome = {"error"};
        final String subtitle =
            reason != null && !reason.isEmpty() ? reason : "Unlock Novend POS";
        activity.runOnUiThread(
            () -> {
                try {
                    BiometricPrompt.PromptInfo info =
                        new BiometricPrompt.PromptInfo.Builder()
                            .setTitle("Novend POS")
                            .setSubtitle(subtitle)
                            .setAllowedAuthenticators(
                                BiometricManager.Authenticators.BIOMETRIC_STRONG
                                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                            .build();
                    BiometricPrompt prompt =
                        new BiometricPrompt(
                            (FragmentActivity) activity,
                            ContextCompat.getMainExecutor(activity),
                            new BiometricPrompt.AuthenticationCallback() {
                                @Override
                                public void onAuthenticationSucceeded(
                                    BiometricPrompt.AuthenticationResult result) {
                                    outcome[0] = "ok";
                                    latch.countDown();
                                }

                                @Override
                                public void onAuthenticationError(
                                    int errorCode, CharSequence errString) {
                                    if (errorCode == BiometricPrompt.ERROR_USER_CANCELED
                                        || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                                        || errorCode == BiometricPrompt.ERROR_CANCELED) {
                                        outcome[0] = "cancelled";
                                    } else {
                                        outcome[0] = "error";
                                    }
                                    latch.countDown();
                                }
                            });
                    prompt.authenticate(info);
                } catch (Exception ignored) {
                    outcome[0] = "error";
                    latch.countDown();
                }
            });
        try {
            if (!latch.await(90, TimeUnit.SECONDS)) {
                return "error";
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return "error";
        }
        return outcome[0];
    }

    private PendingFile takePending() {
        synchronized (lock) {
            if (pending == null || pendingName == null) {
                return null;
            }
            PendingFile file = new PendingFile(pending.toByteArray(), pendingName, pendingMime);
            pending = null;
            pendingName = null;
            pendingMime = null;
            return file;
        }
    }

    private static final class PendingFile {
        final byte[] bytes;
        final String name;
        final String mime;

        PendingFile(byte[] bytes, String name, String mime) {
            this.bytes = bytes;
            this.name = name;
            this.mime = mime;
        }
    }

    private static String sanitizeFileName(String fileName) {
        String raw = fileName == null || fileName.isEmpty() ? "novend-file" : fileName;
        String base = new File(raw).getName();
        String safe = base.replaceAll("[^A-Za-z0-9._-]+", "_");
        return safe.isEmpty() ? "novend-file" : safe;
    }

    private Uri writeDownloads(String fileName, String mimeType, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = context
                .getContentResolver()
                .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new IllegalStateException("Could not create the Downloads entry.");
            }
            try (OutputStream out = context.getContentResolver().openOutputStream(uri)) {
                if (out == null) {
                    throw new IllegalStateException("Could not write the file.");
                }
                out.write(bytes);
            }
            return uri;
        }

        File downloads = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloads == null) {
            throw new IllegalStateException("Could not open app Downloads.");
        }
        if (!downloads.exists() && !downloads.mkdirs()) {
            throw new IllegalStateException("Could not open Downloads.");
        }
        File target = new File(downloads, fileName);
        try (OutputStream out = new FileOutputStream(target)) {
            out.write(bytes);
        }
        return Uri.fromFile(target);
    }
}
