package com.krishnaleelagrand.admin;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
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
        String auth = call.getString("authToken"); // driver login; null for admin phones
        askNotificationPermission();
        if (!firebaseReady()) {
            JSObject r = new JSObject();
            r.put("enabled", false);
            r.put("reason", "Firebase is not configured in this build (google-services.json missing)");
            call.resolve(r);
            return;
        }
        PushPrefs.set(getContext(), true, endpoint, auth);
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
                int code = PushPrefs.register(endpoint, token, auth);
                JSObject r = new JSObject();
                r.put("enabled", code >= 200 && code < 300);
                if (code < 200 || code >= 300) r.put("reason", "Server did not accept the device (HTTP " + code + ")");
                call.resolve(r);
            }).start();
        });
    }

    @PluginMethod
    public void disablePush(PluginCall call) {
        PushPrefs.set(getContext(), false, null, null);
        OrderAlert.stopRing(getContext(), null);
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
        // ColorOS / MIUI often turn notifications off for side-loaded apps on any Android version.
        r.put("permission", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        r.put("ringChannel", OrderAlert.ringChannelOk(getContext()));
        r.put("batteryUnrestricted", batteryUnrestricted());
        r.put("autoStartScreen", autoStartIntent() != null);
        r.put("manufacturer", Build.MANUFACTURER);
        call.resolve(r);
    }

    private boolean batteryUnrestricted() {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        return pm == null || pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }

    /** Phone-maker screens that decide whether a closed app may be woken by a push. */
    private Intent autoStartIntent() {
        String[][] screens = {
                {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                {"com.coloros.oppoguardelf", "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity"},
                {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"},
        };
        PackageManager pm = getContext().getPackageManager();
        for (String[] s : screens) {
            Intent i = new Intent().setComponent(new ComponentName(s[0], s[1])).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ResolveInfo ri = pm.resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY);
            if (ri != null && ri.activityInfo != null && ri.activityInfo.exported) return i;
        }
        return null;
    }

    private boolean tryStart(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Intent appDetails() {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
    }

    /**
     * Opens the phone setting that keeps alerts working with the app closed.
     * what: "battery" | "autostart" | "notifications" | "app"
     */
    @PluginMethod
    public void openAlertSettings(PluginCall call) {
        String what = call.getString("what", "app");
        String pkg = getContext().getPackageName();
        boolean ok = false;
        if ("battery".equals(what)) {
            ok = tryStart(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg)))
                    || tryStart(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        } else if ("autostart".equals(what)) {
            Intent i = autoStartIntent();
            ok = i != null && tryStart(i);
        } else if ("notifications".equals(what)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ok = tryStart(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg));
            }
        }
        if (!ok) ok = tryStart(appDetails());
        JSObject r = new JSObject();
        r.put("opened", ok);
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
        OrderAlert.show(getContext(), title, body, ring, key);
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

    /**
     * Rings for an order whose alert screen is on display, even if a push or
     * poll already rang for it (opening the app stops that earlier ring).
     */
    @PluginMethod
    public void ring(PluginCall call) {
        String key = call.getString("key");
        OrderAlert.firstAlertFor(key); // so a late push/poll does not ring again
        OrderAlert.show(getContext(), call.getString("title", "KLG Delivery"), call.getString("body", ""), true, key);
        call.resolve();
    }

    /** key given: stop only that order's ring; otherwise every ring. */
    @PluginMethod
    public void stopRing(PluginCall call) {
        OrderAlert.stopRing(getContext(), call.getString("key"));
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
