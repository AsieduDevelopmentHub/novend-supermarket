package com.novend.millies;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Classic Bluetooth RFCOMM / SPP for thermal ESC/POS printers.
 * Socket I/O runs off the Capacitor bridge thread.
 */
@CapacitorPlugin(
    name = "NovendBluetoothClassic",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class NovendBluetoothClassicPlugin extends Plugin {

    private static final UUID SPP_UUID =
        UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int CHUNK_SIZE = 512;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicReference<BluetoothSocket> activeSocket = new AtomicReference<>(null);
    private final AtomicReference<String> activeAddress = new AtomicReference<>(null);
    private final AtomicReference<String> activeName = new AtomicReference<>(null);
    private PluginCall pendingPermissionCall;

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasBluetoothPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || hasBluetoothPermission()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        pendingPermissionCall = call;
        requestPermissionForAlias("bluetooth", call, "bluetoothPermissionCallback");
    }

    @PermissionCallback
    private void bluetoothPermissionCallback(PluginCall call) {
        PluginCall target = pendingPermissionCall != null ? pendingPermissionCall : call;
        pendingPermissionCall = null;
        JSObject result = new JSObject();
        result.put("granted", hasBluetoothPermission());
        target.resolve(result);
    }

    @PluginMethod
    public void listBondedDevices(PluginCall call) {
        if (!ensurePermission(call)) return;
        BluetoothAdapter adapter = bluetoothAdapter();
        if (adapter == null) {
            call.reject("Turn on Bluetooth and try again.", "bluetooth_off");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Turn on Bluetooth and try again.", "bluetooth_off");
            return;
        }
        try {
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            JSArray devices = new JSArray();
            if (bonded != null) {
                for (BluetoothDevice device : bonded) {
                    JSObject row = new JSObject();
                    row.put("id", device.getAddress());
                    String name = device.getName();
                    row.put("name", name != null && !name.isEmpty() ? name : device.getAddress());
                    row.put("bonded", true);
                    row.put("transport", "classic");
                    devices.put(row);
                }
            }
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        } catch (SecurityException error) {
            call.reject(
                "Allow Nearby devices / Bluetooth access for Novend, then try again.",
                "permission"
            );
        } catch (Exception error) {
            call.reject(
                error.getMessage() != null
                    ? error.getMessage()
                    : "Could not list paired Bluetooth printers.",
                "write_failed"
            );
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!ensurePermission(call)) return;
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Printer address is missing.", "not_paired");
            return;
        }
        BluetoothAdapter adapter = bluetoothAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Turn on Bluetooth and try again.", "bluetooth_off");
            return;
        }
        executor.execute(() -> {
            BluetoothSocket socket = null;
            try {
                closeSocketQuietly(activeSocket.getAndSet(null));
                activeAddress.set(null);
                activeName.set(null);
                try {
                    adapter.cancelDiscovery();
                } catch (SecurityException ignored) {
                    /* continue */
                }
                BluetoothDevice device = adapter.getRemoteDevice(address);
                if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
                    call.reject(
                        "Pair the printer in Android Bluetooth settings, then choose it here.",
                        "not_paired"
                    );
                    return;
                }
                socket = openSppSocket(device);
                socket.connect();
                activeSocket.set(socket);
                activeAddress.set(address);
                String name = device.getName();
                activeName.set(name != null && !name.isEmpty() ? name : address);
                JSObject result = new JSObject();
                result.put("connected", true);
                result.put("address", address);
                result.put("name", activeName.get());
                call.resolve(result);
            } catch (SecurityException error) {
                closeSocketQuietly(socket);
                call.reject(
                    "Allow Nearby devices / Bluetooth access for Novend, then try again.",
                    "permission"
                );
            } catch (Exception error) {
                closeSocketQuietly(socket);
                call.reject(
                    "Could not reach the printer. Keep it nearby and powered on.",
                    "out_of_range"
                );
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        executor.execute(() -> {
            closeSocketQuietly(activeSocket.getAndSet(null));
            activeAddress.set(null);
            activeName.set(null);
            call.resolve();
        });
    }

    @PluginMethod
    public void writeEscPos(PluginCall call) {
        if (!ensurePermission(call)) return;
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Print data is missing.", "write_failed");
            return;
        }
        final byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("Print data is invalid.", "write_failed");
            return;
        }
        executor.execute(() -> {
            BluetoothSocket socket = activeSocket.get();
            if (socket == null || !socket.isConnected()) {
                call.reject(
                    "Printer is not connected. Reconnect, then try again.",
                    "out_of_range"
                );
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
                call.resolve();
            } catch (IOException error) {
                closeSocketQuietly(activeSocket.getAndSet(null));
                activeAddress.set(null);
                activeName.set(null);
                call.reject(
                    "Could not print to the Bluetooth printer.",
                    "write_failed"
                );
            }
        });
    }

    @PluginMethod
    public void getConnectionState(PluginCall call) {
        JSObject result = new JSObject();
        BluetoothSocket socket = activeSocket.get();
        boolean connected = socket != null && socket.isConnected();
        result.put("connected", connected);
        result.put("address", connected ? activeAddress.get() : null);
        result.put("name", connected ? activeName.get() : null);
        call.resolve(result);
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open Bluetooth settings.");
        }
    }

    private boolean ensurePermission(PluginCall call) {
        if (hasBluetoothPermission()) return true;
        call.reject(
            "Allow Nearby devices / Bluetooth access for Novend, then try again.",
            "permission"
        );
        return false;
    }

    private boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ActivityCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.BLUETOOTH_CONNECT
            )
            == PackageManager.PERMISSION_GRANTED;
    }

    private BluetoothAdapter bluetoothAdapter() {
        BluetoothManager manager =
            (BluetoothManager) getContext().getSystemService(android.content.Context.BLUETOOTH_SERVICE);
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

    private static void closeSocketQuietly(BluetoothSocket socket) {
        if (socket == null) return;
        try {
            socket.close();
        } catch (IOException ignored) {
            /* ignore */
        }
    }

    @Override
    protected void handleOnDestroy() {
        closeSocketQuietly(activeSocket.getAndSet(null));
        activeAddress.set(null);
        activeName.set(null);
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
