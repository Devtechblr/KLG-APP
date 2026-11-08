package com.krishnaleelagrand.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import java.util.HashMap;
import java.util.Map;

/**
 * Order alerts. Only the app's own sound (res/raw/order_alert.wav) is ever
 * played; the phone's default notification sound never is:
 *  - every notification channel of the app is silent;
 *  - RingService (foreground service) plays order_alert.wav in a loop, also
 *    when the app is in the background or closed and FCM woke it;
 *  - if Android refuses the service, the same file is played from here
 *    (fallbackRing) under a silent notification.
 * Info alerts (cancelled orders) are silent.
 */
public final class OrderAlert {
    /** Silent ringing channel shared with RingService. */
    static final String CHANNEL_ID = RingService.CHANNEL_ID;
    static final String QUIET_CHANNEL_ID = "klg_order_info_v2";
    /** Older channels that had a sound (default or custom); removed so nothing uses them. */
    private static final String[] OLD_CHANNELS = {"klg_order_alerts", "klg_order_ring_v2", "klg_order_info"};
    private static final long MAX_RING_MS = 45_000L;

    private static final Handler handler = new Handler(Looper.getMainLooper());
    /** Fallback rings: key -> {notification id, title, body}. */
    private static final Map<String, Object[]> ringing = new HashMap<>();
    private static final Map<String, Runnable> stopTasks = new HashMap<>();
    private static MediaPlayer fallbackPlayer;

    private static final long DEDUPE_MS = 10 * 60_000L;
    private static final Map<String, Long> alerted = new HashMap<>();

    private OrderAlert() {}

    /**
     * True the first time an order is alerted (within 10 min). The FCM push and
     * the app's own poll can both see the same new order; only the first rings.
     */
    static synchronized boolean firstAlertFor(String orderKey) {
        if (orderKey == null) return true;
        long now = System.currentTimeMillis();
        alerted.values().removeIf(t -> now - t > DEDUPE_MS);
        if (alerted.containsKey(orderKey)) return false;
        alerted.put(orderKey, now);
        return true;
    }

    static Uri soundUri(Context ctx) {
        return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + ctx.getPackageName() + "/" + R.raw.order_alert);
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        for (String old : OLD_CHANNELS) {
            if (nm.getNotificationChannel(old) != null) nm.deleteNotificationChannel(old);
        }
        RingService.ensureChannel(ctx);
        if (nm.getNotificationChannel(QUIET_CHANNEL_ID) == null) {
            NotificationChannel q = new NotificationChannel(QUIET_CHANNEL_ID, "Order updates", NotificationManager.IMPORTANCE_DEFAULT);
            q.setDescription("Cancelled orders and other updates (silent)");
            q.setSound(null, null);
            q.enableVibration(false);
            nm.createNotificationChannel(q);
        }
    }

    /** False when the user (or the phone maker's default) turned the ringing channel down. */
    static boolean ringChannelOk(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        NotificationChannel ch = ctx.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL_ID);
        return ch == null || ch.getImportance() >= NotificationManager.IMPORTANCE_HIGH;
    }

    private static PendingIntent openApp(Context ctx) {
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Ringing notification: silent (the app plays order_alert.wav itself), full-screen like a call. */
    static Notification buildRinging(Context ctx, String channel, String title, String body) {
        PendingIntent pi = openApp(ctx);
        return new NotificationCompat.Builder(ctx, channel)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(pi)
                .setFullScreenIntent(pi, true)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSound(null)
                .setVibrate(null)
                .setDefaults(0)
                .build();
    }

    private static Notification buildQuiet(Context ctx, String title, String body) {
        return new NotificationCompat.Builder(ctx, QUIET_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(openApp(ctx))
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setSound(null)
                .setVibrate(null)
                .setDefaults(0)
                .setOnlyAlertOnce(true)
                .build();
    }

    static void showQuiet(Context ctx, String title, String body) {
        ensureChannel(ctx);
        post(ctx, (int) (System.currentTimeMillis() & 0x7fffffff), buildQuiet(ctx, title, body));
    }

    private static void post(Context ctx, int id, Notification n) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            nm.notify(id, n);
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS denied on Android 13+. Settings → Order alerts shows this.
        }
    }

    /** Shows the alert; with ring = true it rings until stopRing or MAX_RING_MS. */
    static synchronized void show(Context ctx, String title, String body, boolean ring, String key) {
        ensureChannel(ctx);
        final Context app = ctx.getApplicationContext();
        if (!ring) {
            showQuiet(app, title, body);
            return;
        }
        final String k = key != null ? key : "local";
        if (RingService.start(app, title, body, k)) return;
        fallbackRing(app, title, body, k);
    }

    /** Service not allowed: same app sound, played from this process, silent notification. */
    static synchronized void fallbackRing(Context ctx, String title, String body, String k) {
        final Context app = ctx.getApplicationContext();
        ensureChannel(app);
        final int id = ("ring:" + k).hashCode() & 0x7fffffff;
        cancelTimer(k);
        ringing.put(k, new Object[]{id, title, body});
        post(app, id, buildRinging(app, CHANNEL_ID, title, body));
        startFallbackSound(app);
        Runnable t = () -> silence(app, k);
        stopTasks.put(k, t);
        handler.postDelayed(t, MAX_RING_MS);
    }

    private static void startFallbackSound(Context ctx) {
        if (fallbackPlayer != null) return;
        try {
            MediaPlayer p = new MediaPlayer();
            p.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            p.setDataSource(ctx, soundUri(ctx));
            p.setLooping(true);
            p.setWakeMode(ctx, PowerManager.PARTIAL_WAKE_LOCK);
            p.prepare();
            p.start();
            fallbackPlayer = p;
        } catch (Exception ignored) {
            fallbackPlayer = null;
        }
    }

    private static void stopFallbackSoundIfIdle() {
        if (!ringing.isEmpty() || fallbackPlayer == null) return;
        try { fallbackPlayer.stop(); } catch (Exception ignored) {}
        fallbackPlayer.release();
        fallbackPlayer = null;
    }

    private static void cancelTimer(String key) {
        Runnable t = stopTasks.remove(key);
        if (t != null) handler.removeCallbacks(t);
    }

    /** Time-out: stop the sound but leave a silent notification in the tray. */
    private static synchronized void silence(Context ctx, String key) {
        stopTasks.remove(key);
        Object[] r = ringing.remove(key);
        stopFallbackSoundIfIdle();
        if (r == null) return;
        post(ctx, (Integer) r[0], buildQuiet(ctx, (String) r[1], (String) r[2]));
    }

    /**
     * Stops the ring. key == null stops every ring (app opened); otherwise only
     * that order's (ORDER_RESOLVED push). The ringing notification is removed:
     * the order is now on screen or already handled.
     */
    static synchronized void stopRing(Context ctx, String key) {
        RingService.stop(key);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        for (String k : new java.util.ArrayList<>(ringing.keySet())) {
            if (key != null && !key.equals(k)) continue;
            cancelTimer(k);
            Object[] r = ringing.remove(k);
            nm.cancel((Integer) r[0]);
        }
        stopFallbackSoundIfIdle();
        // Rung by an earlier (since killed) process: not in the map any more.
        if (key != null) {
            nm.cancel(("ring:" + key).hashCode() & 0x7fffffff);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            for (android.service.notification.StatusBarNotification s : nm.getActiveNotifications()) {
                if (s.getId() == RingService.NOTIF_ID) continue; // the service removes its own
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                        || CHANNEL_ID.equals(s.getNotification().getChannelId())) nm.cancel(s.getId());
            }
        }
    }
}
