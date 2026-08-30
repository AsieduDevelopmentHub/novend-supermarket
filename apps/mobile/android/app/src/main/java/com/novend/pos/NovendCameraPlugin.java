package com.novend.pos;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

/**
 * System camera via ACTION_IMAGE_CAPTURE. Official {@code Camera.getPhoto} is
 * unreliable after the WebView leaves the local boot origin.
 */
@CapacitorPlugin(name = "NovendCamera")
public class NovendCameraPlugin extends Plugin {

    private String pendingPath;

    @PluginMethod
    public void capturePhoto(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Could not capture a photo. Please try again.");
            return;
        }
        try {
            File photo = new File(getContext().getCacheDir(), "novend-capture.jpg");
            pendingPath = photo.getAbsolutePath();
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                photo
            );
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.addFlags(
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
            startActivityForResult(call, intent, "onCapture");
        } catch (Exception error) {
            call.reject("Could not capture a photo. Please try again.");
        }
    }

    @ActivityCallback
    private void onCapture(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Cancelled");
            return;
        }
        String path = pendingPath;
        pendingPath = null;
        if (path == null || path.isEmpty()) {
            call.reject("Could not capture a photo. Please try again.");
            return;
        }
        File photo = new File(path);
        if (!photo.isFile() || photo.length() == 0) {
            call.reject("Could not capture a photo. Please try again.");
            return;
        }
        try {
            byte[] bytes = readAll(photo);
            JSObject out = new JSObject();
            out.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            out.put("mimeType", "image/jpeg");
            call.resolve(out);
        } catch (Exception error) {
            call.reject("Could not capture a photo. Please try again.");
        }
    }

    private static byte[] readAll(File file) throws Exception {
        byte[] bytes = new byte[(int) file.length()];
        try (InputStream in = new FileInputStream(file)) {
            int offset = 0;
            while (offset < bytes.length) {
                int read = in.read(bytes, offset, bytes.length - offset);
                if (read < 0) {
                    break;
                }
                offset += read;
            }
        }
        return bytes;
    }
}
