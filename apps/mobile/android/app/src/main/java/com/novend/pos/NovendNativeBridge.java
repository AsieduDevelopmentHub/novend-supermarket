package com.novend.pos;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * WebView JavascriptInterface — not the Capacitor plugin bridge.
 * After the hosted origin loads, official Cap plugins often hang; this channel
 * still writes files into the public Downloads folder.
 */
public class NovendNativeBridge {

    private final Context context;
    private final Object lock = new Object();
    private ByteArrayOutputStream pending;
    private String pendingName;
    private String pendingMime;

    public NovendNativeBridge(Context context) {
        this.context = context.getApplicationContext();
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
        byte[] bytes;
        String name;
        String mime;
        synchronized (lock) {
            if (pending == null || pendingName == null) {
                return false;
            }
            bytes = pending.toByteArray();
            name = pendingName;
            mime = pendingMime;
            pending = null;
            pendingName = null;
            pendingMime = null;
        }
        try {
            writeDownloads(name, mime, bytes);
            return true;
        } catch (Exception ignored) {
            return false;
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
