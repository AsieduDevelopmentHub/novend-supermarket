package com.novend.pos;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
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
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.fragment.app.FragmentActivity;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * WebView JavascriptInterface — not the Capacitor plugin bridge.
 * After the hosted origin loads, official Cap plugins often hang; this channel
 * still writes Downloads, share, biometrics, app info, and Classic Bluetooth print.
 */
public class NovendNativeBridge {

    private static final UUID SPP_UUID =
        UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int CHUNK_SIZE = 512;
    /** Bound heap usage, including the decoded copy made by takePending(). */
    private static final int MAX_PENDING_FILE_BYTES = 32 * 1024 * 1024;

    private final Activity activity;
    private final Context context;
    private final Object lock = new Object();
    private ByteArrayOutputStream pending;
    private String pendingName;
    private String pendingMime;

    private final ExecutorService classicExecutor = Executors.newSingleThreadExecutor();
    private final AtomicReference<BluetoothSocket> classicSocket = new AtomicReference<>(null);
    private final AtomicReference<String> classicAddress = new AtomicReference<>(null);

    public NovendNativeBridge(Activity activity) {
        this.activity = activity;
        this.context = activity.getApplicationContext();
    }

    /**
     * Package / version from PackageManager — Cap App.getInfo hangs on hosted origin.
     * JSON: name, id, version, build.
     */
    @JavascriptInterface
    public String appInfo() {
        JSONObject out = new JSONObject();
        try {
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();
            PackageInfo info =
                Build.VERSION.SDK_INT >= 33
                    ? pm.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
                    : pm.getPackageInfo(packageName, 0);
            CharSequence label = pm.getApplicationLabel(info.applicationInfo);
            out.put("name", label != null ? label.toString() : "Novend POS");
            out.put("id", packageName);
            out.put("version", info.versionName != null ? info.versionName : "");
            long code =
                Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            out.put("build", String.valueOf(code));
        } catch (Exception error) {
            try {
                out.put("name", "Novend POS");
                out.put("id", context.getPackageName());
                out.put("version", "");
                out.put("build", "");
            } catch (Exception ignored) {
                return "{\"name\":\"Novend POS\",\"id\":\"com.novend.pos\",\"version\":\"\",\"build\":\"\"}";
            }
        }
        return out.toString();
    }

    @JavascriptInterface
    public boolean openAppDetailsSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", context.getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    /**
     * In-app Nearby devices / Bluetooth permission dialog (Android 12+).
     * Returns granted|denied. Never opens App Info.
     */
    @JavascriptInterface
    public String classicRequestBluetoothPermission() {
        if (!(activity instanceof MainActivity)) {
            return hasBluetoothConnectPermission() ? "granted" : "denied";
        }
        try {
            return ((MainActivity) activity).requestBluetoothPermissionsBlocking();
        } catch (Exception ignored) {
            return hasBluetoothConnectPermission() ? "granted" : "denied";
        }
    }

    /** Classic SPP bonded printers — JSON { ok, code?, message?, devices:[{id,name}] }. */
    @JavascriptInterface
    public String classicListBondedPrinters() {
        JSONObject out = new JSONObject();
        try {
            if (!hasBluetoothConnectPermission()) {
                out.put("ok", false);
                out.put("code", "permission");
                out.put(
                    "message",
                    "Enable Bluetooth / Nearby devices for Novend, then list paired printers again."
                );
                out.put("devices", new JSONArray());
                return out.toString();
            }
            BluetoothAdapter adapter = bluetoothAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                out.put("ok", false);
                out.put("code", "bluetooth_off");
                out.put("message", "Turn on Bluetooth and try again.");
                out.put("devices", new JSONArray());
                return out.toString();
            }
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            JSONArray devices = new JSONArray();
            if (bonded != null) {
                for (BluetoothDevice device : bonded) {
                    JSONObject row = new JSONObject();
                    row.put("id", device.getAddress());
                    String name = device.getName();
                    row.put("name", name != null && !name.isEmpty() ? name : device.getAddress());
                    devices.put(row);
                }
            }
            out.put("ok", true);
            out.put("devices", devices);
        } catch (SecurityException error) {
            try {
                out.put("ok", false);
                out.put("code", "permission");
                out.put(
                    "message",
                    "Enable Bluetooth / Nearby devices for Novend, then list paired printers again."
                );
                out.put("devices", new JSONArray());
            } catch (Exception ignored) {
                return "{\"ok\":false,\"code\":\"permission\",\"devices\":[]}";
            }
        } catch (Exception error) {
            try {
                out.put("ok", false);
                out.put("code", "write_failed");
                out.put(
                    "message",
                    error.getMessage() != null
                        ? error.getMessage()
                        : "Could not list paired Bluetooth printers."
                );
                out.put("devices", new JSONArray());
            } catch (Exception ignored) {
                return "{\"ok\":false,\"code\":\"write_failed\",\"devices\":[]}";
            }
        }
        return out.toString();
    }

    /** Blocks until RFCOMM connect settles. Returns ok|permission|bluetooth_off|not_paired|out_of_range. */
    @JavascriptInterface
    public String classicConnect(String address) {
        if (address == null || address.isEmpty()) return "not_paired";
        if (!hasBluetoothConnectPermission()) return "permission";
        BluetoothAdapter adapter = bluetoothAdapter();
        if (adapter == null || !adapter.isEnabled()) return "bluetooth_off";

        final CountDownLatch latch = new CountDownLatch(1);
        final String[] outcome = {"out_of_range"};
        classicExecutor.execute(
            () -> {
                BluetoothSocket socket = null;
                try {
                    closeClassicSocketQuietly(classicSocket.getAndSet(null));
                    classicAddress.set(null);
                    try {
                        adapter.cancelDiscovery();
                    } catch (SecurityException ignored) {
                        /* continue */
                    }
                    BluetoothDevice device = adapter.getRemoteDevice(address);
                    if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
                        outcome[0] = "not_paired";
                        return;
                    }
                    socket = openSppSocket(device);
                    socket.connect();
                    classicSocket.set(socket);
                    classicAddress.set(address);
                    outcome[0] = "ok";
                } catch (SecurityException error) {
                    closeClassicSocketQuietly(socket);
                    outcome[0] = "permission";
                } catch (Exception error) {
                    closeClassicSocketQuietly(socket);
                    outcome[0] = "out_of_range";
                } finally {
                    latch.countDown();
                }
            }
        );
        try {
            if (!latch.await(25, TimeUnit.SECONDS)) {
                return "out_of_range";
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return "out_of_range";
        }
        return outcome[0];
    }

    @JavascriptInterface
    public void classicDisconnect() {
        classicExecutor.execute(
            () -> {
                closeClassicSocketQuietly(classicSocket.getAndSet(null));
                classicAddress.set(null);
            }
        );
    }

    /** Blocks until write settles. Returns ok|out_of_range|write_failed|permission. */
    @JavascriptInterface
    public String classicWriteEscPos(String base64) {
        if (base64 == null || base64.isEmpty()) return "write_failed";
        if (!hasBluetoothConnectPermission()) return "permission";
        final byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            return "write_failed";
        }
        final CountDownLatch latch = new CountDownLatch(1);
        final String[] outcome = {"write_failed"};
        classicExecutor.execute(
            () -> {
                BluetoothSocket socket = classicSocket.get();
                if (socket == null || !socket.isConnected()) {
                    outcome[0] = "out_of_range";
                    latch.countDown();
                    return;
                }
                try {
                    OutputStream out = socket.getOutputStream();
                    int offset = 0;
                    while (offset < bytes.length) {
                        int length = Math.min(CHUNK_SIZE, bytes.length - offset);
                        out.write(bytes, offset, length);
                        offset += length;
                    }
                    out.flush();
                    outcome[0] = "ok";
                } catch (IOException error) {
                    closeClassicSocketQuietly(classicSocket.getAndSet(null));
                    classicAddress.set(null);
                    outcome[0] = "write_failed";
                } finally {
                    latch.countDown();
                }
            }
        );
        try {
            if (!latch.await(25, TimeUnit.SECONDS)) {
                return "write_failed";
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return "write_failed";
        }
        return outcome[0];
    }

    @JavascriptInterface
    public boolean classicOpenBluetoothSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean classicIsConnected(String address) {
        BluetoothSocket socket = classicSocket.get();
        String active = classicAddress.get();
        return socket != null
            && socket.isConnected()
            && address != null
            && address.equals(active);
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
    public int maxSaveBytes() {
        return MAX_PENDING_FILE_BYTES;
    }

    @JavascriptInterface
    public void cancelSave() {
        synchronized (lock) { clearPending(); }
    }

    @JavascriptInterface
    public boolean appendChunk(String base64) {
        if (base64 == null || base64.isEmpty()) {
            return false;
        }
        synchronized (lock) {
            if (pending == null) {
                return false;
            }
            try {
                // Reject oversized encoded input before allocating its decoded buffer.
                if (base64.length() > ((MAX_PENDING_FILE_BYTES - pending.size()) / 3L + 1) * 4) {
                    clearPending();
                    return false;
                }
                byte[] chunk = Base64.decode(base64, Base64.DEFAULT);
                if (chunk.length > MAX_PENDING_FILE_BYTES - pending.size()) {
                    clearPending();
                    return false;
                }
                pending.write(chunk, 0, chunk.length);
                return true;
            } catch (IllegalArgumentException ignored) {
                clearPending();
                return false;
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
     *
     * Many Android phones enroll Class 2 (weak) fingerprints. Checking
     * BIOMETRIC_STRONG only reports "unavailable" on those devices even
     * though the user unlocks the phone with a fingerprint.
     */
    @JavascriptInterface
    public String biometricStatus() {
        JSONObject out = new JSONObject();
        try {
            BiometricManager manager = BiometricManager.from(context);
            int can = canAuthenticateBiometric(manager);
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
            String reason = biometricReason(can);
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
                out.put("reason", "Could not read biometric hardware on this device.");
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
        final int authenticators = promptAuthenticators(BiometricManager.from(context));
        activity.runOnUiThread(
            () -> {
                try {
                    BiometricPrompt.PromptInfo.Builder builder =
                        new BiometricPrompt.PromptInfo.Builder()
                            .setTitle("Novend POS")
                            .setSubtitle(subtitle)
                            .setAllowedAuthenticators(authenticators);
                    if ((authenticators & BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                        == 0) {
                        builder.setNegativeButtonText("Cancel");
                    }
                    BiometricPrompt.PromptInfo info = builder.build();
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

    /**
     * BIOMETRIC_WEAK includes Class 3. Checking STRONG alone reports
     * NONE_ENROLLED on phones that only enrolled a Class 2 fingerprint —
     * the usual Settings → Biometrics “Try again” failure.
     */
    private static int canAuthenticateBiometric(BiometricManager manager) {
        return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
    }

    /**
     * Prefer Class 3 + device PIN when a strong biometric is enrolled.
     * BIOMETRIC_WEAK cannot be combined with DEVICE_CREDENTIAL in BiometricPrompt.
     */
    private static int promptAuthenticators(BiometricManager manager) {
        int strong = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        if (strong == BiometricManager.BIOMETRIC_SUCCESS) {
            return BiometricManager.Authenticators.BIOMETRIC_STRONG
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        }
        return BiometricManager.Authenticators.BIOMETRIC_WEAK;
    }

    private static String biometricReason(int can) {
        if (can == BiometricManager.BIOMETRIC_SUCCESS) return "";
        if (can == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
            return "Add a fingerprint or face unlock in Android settings, then return.";
        }
        if (can == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE) {
            return "Biometric hardware is temporarily unavailable. Try again in a moment.";
        }
        if (can == BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED) {
            return "Install a security update on this device, then try biometrics again.";
        }
        return "This device does not support fingerprint or face unlock.";
    }

    private boolean hasBluetoothConnectPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT)
            == PackageManager.PERMISSION_GRANTED;
    }

    private BluetoothAdapter bluetoothAdapter() {
        BluetoothManager manager =
            (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager != null) {
            return manager.getAdapter();
        }
        return BluetoothAdapter.getDefaultAdapter();
    }

    private BluetoothSocket openSppSocket(BluetoothDevice device) throws IOException {
        try {
            return device.createRfcommSocketToServiceRecord(SPP_UUID);
        } catch (IOException primary) {
            try {
                Method method = device.getClass().getMethod("createRfcommSocket", int.class);
                Object created = method.invoke(device, 1);
                if (created instanceof BluetoothSocket) {
                    return (BluetoothSocket) created;
                }
            } catch (Exception ignored) {
                /* fall through */
            }
            throw primary;
        }
    }

    private static void closeClassicSocketQuietly(BluetoothSocket socket) {
        if (socket == null) return;
        try {
            socket.close();
        } catch (IOException ignored) {
            /* ignore */
        }
    }

    private void clearPending() {
        pending = null;
        pendingName = null;
        pendingMime = null;
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
