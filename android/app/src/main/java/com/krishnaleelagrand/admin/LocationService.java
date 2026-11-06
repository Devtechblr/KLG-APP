package com.krishnaleelagrand.admin;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Driver live location while an order is OUT_FOR_DELIVERY.
 * Runs as a foreground service so GPS keeps flowing to
 * POST /rider/orders/:orderId/location with the screen off; the customer's
 * order-tracking page (order.krishnaleelagrand.com) shows it on its map.
 * Stops itself when the server says the order is no longer out for delivery.
 */
public class LocationService extends Service implements LocationListener {
    static final String CHANNEL_ID = "klg_live_location";
    private static final int NOTIF_ID = 4242;
    private static final long MIN_INTERVAL_MS = 10_000L;
    private static final float MIN_DISTANCE_M = 15f;

    private final ExecutorService net = Executors.newSingleThreadExecutor();
    private LocationManager lm;
    private String url;
    private String token;
    private String orderId;
    private long lastSent = 0;

    static void start(Context ctx, String endpoint, String token, String orderId) {
        Intent i = new Intent(ctx, LocationService.class)
                .putExtra("endpoint", endpoint).putExtra("token", token).putExtra("orderId", orderId);
        ContextCompat.startForegroundService(ctx, i);
    }

    static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, LocationService.class));
    }

    static boolean hasPermission(Context ctx) {
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !hasPermission(this)) { stopSelf(); return START_NOT_STICKY; }
        url = intent.getStringExtra("endpoint");
        token = intent.getStringExtra("token");
        orderId = intent.getStringExtra("orderId");
        if (url == null || token == null || orderId == null) { stopSelf(); return START_NOT_STICKY; }

        Notification n = notification();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIF_ID, n);
        }

        stopUpdates();
        lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        try {
            for (String p : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                if (lm.isProviderEnabled(p)) lm.requestLocationUpdates(p, MIN_INTERVAL_MS, MIN_DISTANCE_M, this, Looper.getMainLooper());
            }
            Location last = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last == null) last = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            if (last != null) onLocationChanged(last);
        } catch (SecurityException e) {
            stopSelf();
        }
        return START_REDELIVER_INTENT;
    }

    private Notification notification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Live delivery location", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shown while your location is shared with the customer");
            nm.createNotificationChannel(ch);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Delivering order " + orderId)
                .setContentText("Your live location is shared with the customer")
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    @Override
    public void onLocationChanged(@NonNull Location loc) {
        long now = System.currentTimeMillis();
        if (now - lastSent < MIN_INTERVAL_MS - 500) return;
        lastSent = now;
        final String body = String.format(Locale.US, "{\"latitude\":%.7f,\"longitude\":%.7f,\"accuracy\":%.1f}",
                loc.getLatitude(), loc.getLongitude(), loc.hasAccuracy() ? loc.getAccuracy() : 0f);
        final String target = url, auth = token;
        net.execute(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(target).openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(15000);
                c.setReadTimeout(15000);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                c.setRequestProperty("Authorization", "Bearer " + auth);
                try (OutputStream os = c.getOutputStream()) { os.write(body.getBytes(StandardCharsets.UTF_8)); }
                int code = c.getResponseCode();
                // 400: no longer OUT_FOR_DELIVERY, 401/403: not this driver, 404: gone.
                if (code == 400 || code == 401 || code == 403 || code == 404) stopSelf();
            } catch (Exception ignored) {
                // offline for a moment: next fix retries
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    private void stopUpdates() {
        if (lm != null) {
            try { lm.removeUpdates(this); } catch (Exception ignored) {}
        }
    }

    @Override
    public void onDestroy() {
        stopUpdates();
        net.shutdown();
        super.onDestroy();
    }

    @Override public void onProviderEnabled(@NonNull String provider) {}
    @Override public void onProviderDisabled(@NonNull String provider) {}
    @Override public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}
    @Override public IBinder onBind(Intent intent) { return null; }
}
