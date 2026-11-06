package com.krishnaleelagrand.admin;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

/** JS bridge: src/services/native/notifications.js (registerPlugin('KlgNative')). */
@CapacitorPlugin(
        name = "KlgNative",
        permissions = {
                @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT }),
                @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION })
        }
)
public class KlgNativePlugin extends Plugin {

    private boolean firebaseReady() {
        try {
            return !FirebaseApp.getApps(getContext()).isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && getActivity() != null &&
                ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7001);
        }
    }

    @PluginMethod
    public void enablePush(PluginCall call) {
        String endpoint = call.getString("endpoint");
        askNotificationPermission();
        if (!firebaseReady()) {
            JSObject r = new JSObject();
            r.put("enabled", false);
            r.put("reason", "Firebase is not configured in this build (google-services.json missing)");
            call.resolve(r);
            return;
        }
        PushPrefs.set(getContext(), true, endpoint);
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                JSObject r = new JSObject();
                r.put("enabled", false);
                r.put("reason", task.getException() != null ? task.getException().getMessage() : "No FCM token");
                call.resolve(r);
                return;
            }
            String token = task.getResult();
            new Thread(() -> {
                int code = PushPrefs.register(endpoint, token);
                JSObject r = new JSObject();
                r.put("enabled", code >= 200 && code < 300);
                if (code < 200 || code >= 300) r.put("reason", "Server did not accept the device (HTTP " + code + ")");
                call.resolve(r);
            }).start();
        });
    }

    @PluginMethod
    public void disablePush(PluginCall call) {
        PushPrefs.set(getContext(), false, null);
        OrderAlert.stopRing(null);
        if (firebaseReady()) {
            // Invalidates the token; the backend prunes it on its next send.
            try { FirebaseMessaging.getInstance().deleteToken(); } catch (Exception ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void pushStatus(PluginCall call) {
        JSObject r = new JSObject();
        boolean on = PushPrefs.enabled(getContext()) && firebaseReady();
        r.put("enabled", on);
        if (!firebaseReady()) r.put("reason", "Firebase is not configured in this build (google-services.json missing)");
        else if (!on) r.put("reason", "not registered");
        if (Build.VERSION.SDK_INT >= 33) {
            r.put("permission", ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
        } else {
            r.put("permission", true);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void notify(PluginCall call) {
        askNotificationPermission();
        String title = call.getString("title", "KLG Delivery");
        String body = call.getString("body", "");
        boolean ring = Boolean.TRUE.equals(call.getBoolean("ring", true));
        // Same order key as the FCM push, so one order never alerts twice.
        String key = call.getString("key");
        if (key != null && !OrderAlert.firstAlertFor(key)) { call.resolve(); return; }
        OrderAlert.show(getContext(), title, body);
        if (ring) OrderAlert.startRing(getContext(), key != null ? key : "local");
        call.resolve();
    }

    // ---- Driver live location (src/services/native/location.js) -------------

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (!LocationService.hasPermission(getContext())) {
            requestPermissionForAlias("location", call, "locationPermCallback");
            return;
        }
        askNotificationPermission();
        startTrackingNow(call);
    }

    @PermissionCallback
    private void locationPermCallback(PluginCall call) {
        if (!LocationService.hasPermission(getContext())) {
            JSObject r = new JSObject();
            r.put("tracking", false);
            r.put("reason", "permission");
            call.resolve(r);
            return;
        }
        startTrackingNow(call);
    }

    private void startTrackingNow(PluginCall call) {
        String endpoint = call.getString("endpoint");
        String token = call.getString("token");
        String orderId = call.getString("orderId");
        JSObject r = new JSObject();
        try {
            LocationService.start(getContext(), endpoint, token, orderId);
            r.put("tracking", true);
        } catch (Exception e) {
            r.put("tracking", false);
            r.put("reason", e.getMessage());
        }
        call.resolve(r);
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        LocationService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stopRing(PluginCall call) {
        OrderAlert.stopRing(null);
        call.resolve();
    }

    // ---- Bluetooth thermal printer (src/services/native/printer.js) ---------

    private boolean needsBluetoothPermission() {
        return Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    @PluginMethod
    public void printerList(PluginCall call) {
        if (needsBluetoothPermission()) { requestPermissionForAlias("bluetooth", call, "afterBluetoothPermission"); return; }
        doPrinterList(call);
    }

    @PluginMethod
    public void printerPrint(PluginCall call) {
        if (needsBluetoothPermission()) { requestPermissionForAlias("bluetooth", call, "afterBluetoothPermission"); return; }
        doPrinterPrint(call);
    }

    @PermissionCallback
    private void afterBluetoothPermission(PluginCall call) {
        if (needsBluetoothPermission()) {
            call.reject("Allow \"Nearby devices\" for KLG Delivery to use the Bluetooth printer.");
            return;
        }
        if ("printerPrint".equals(call.getMethodName())) doPrinterPrint(call);
        else doPrinterList(call);
    }

    private void doPrinterList(PluginCall call) {
        try {
            JSArray list = new JSArray();
            for (BluetoothPrinter.Paired p : BluetoothPrinter.paired(getContext())) {
                JSObject o = new JSObject();
                o.put("name", p.name);
                o.put("address", p.address);
                o.put("printer", p.looksLikePrinter);
                list.put(o);
            }
            JSObject r = new JSObject();
            r.put("devices", list);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private void doPrinterPrint(PluginCall call) {
        String address = call.getString("address");
        String data = call.getString("data");
        if (data == null) { call.reject("Nothing to print"); return; }
        final byte[] bytes;
        try { bytes = Base64.decode(data, Base64.DEFAULT); } catch (Exception e) { call.reject("Bad print data"); return; }
        new Thread(() -> {
            try {
                synchronized (KlgNativePlugin.class) { // one job at a time on the printer
                    BluetoothPrinter.print(getContext(), address, bytes);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        }).start();
    }
}
