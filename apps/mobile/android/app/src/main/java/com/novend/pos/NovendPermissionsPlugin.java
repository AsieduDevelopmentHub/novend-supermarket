package com.novend.pos;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Native permission facts that LocalNotifications does not expose. */
@CapacitorPlugin(name = "NovendPermissions")
public class NovendPermissionsPlugin extends Plugin {

    private static final String PREFS = "novend.native.permissions";
    private static final String NOTIFICATIONS_REQUESTED = "notificationsRequested";

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            result.put(
                "state",
                NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
                    ? "granted"
                    : "permanently-denied"
            );
            call.resolve(result);
            return;
        }

        boolean granted =
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            result.put("state", "granted");
        } else {
            SharedPreferences prefs = getContext().getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
            );
            boolean requested = prefs.getBoolean(NOTIFICATIONS_REQUESTED, false);
            boolean rationale = ActivityCompat.shouldShowRequestPermissionRationale(
                getActivity(),
                Manifest.permission.POST_NOTIFICATIONS
            );
            result.put(
                "state",
                rationale ? "denied" : !requested ? "not-requested" : "permanently-denied"
            );
        }
        call.resolve(result);
    }

    @PluginMethod
    public void markNotificationPermissionRequested(PluginCall call) {
        getContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(NOTIFICATIONS_REQUESTED, true)
                .apply();
        call.resolve();
    }
}
