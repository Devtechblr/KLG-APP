package com.krishnaleelagrand.admin;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

/** JS bridge: src/services/native/notifications.js (registerPlugin('KlgNative')). */
@CapacitorPlugin(name = "KlgNative")
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
        OrderAlert.show(getContext(), title, body);
        if (ring) OrderAlert.startRing(getContext(), "local");
        call.resolve();
    }

    @PluginMethod
    public void stopRing(PluginCall call) {
        OrderAlert.stopRing(null);
        call.resolve();
    }
}
