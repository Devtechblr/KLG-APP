package com.krishnaleelagrand.admin;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Whether this phone should receive the backend's new-order pushes, and the
 * endpoint used to register its FCM token (POST /public/device-tokens).
 * Admin phones register at POST /public/device-tokens (every new order).
 * Driver phones register at POST /rider/device-token with their login token
 * ("auth"), and then get only their own offers.
 */
final class PushPrefs {
    private static final String FILE = "klg_push";
    private static final String TAG = "KlgPush";

    private PushPrefs() {}

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    static boolean enabled(Context c) { return sp(c).getBoolean("enabled", false); }

    static String endpoint(Context c) { return sp(c).getString("endpoint", null); }

    static String auth(Context c) { return sp(c).getString("auth", null); }

    static void set(Context c, boolean enabled, String endpoint, String auth) {
        SharedPreferences.Editor e = sp(c).edit().putBoolean("enabled", enabled);
        if (endpoint != null) e.putString("endpoint", endpoint);
        if (auth != null) e.putString("auth", auth); else e.remove("auth");
        e.apply();
    }

    /** Blocking; call off the main thread. Returns the HTTP status or -1. */
    static int register(String endpoint, String token, String auth) {
        if (endpoint == null || token == null) return -1;
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(endpoint).openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            if (auth != null) conn.setRequestProperty("Authorization", "Bearer " + auth);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            String body = "{\"token\":\"" + token.replace("\"", "") + "\",\"platform\":\"" + (auth != null ? "android-driver" : "android-delivery") + "\"}";
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            Log.d(TAG, "Device token registered: HTTP " + code);
            return code;
        } catch (Exception e) {
            Log.e(TAG, "Device token registration failed: " + e.getMessage());
            return -1;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
