package com.krishnaleelagrand.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.content.ContextCompat;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Plays the order ring (res/raw/order_alert.wav, the same sound as the in-app
 * alert) from a foreground service, so it keeps ringing when the app is in the
 * background or closed and FCM only woke the process for a moment.
 *
 * Phone makers (ColorOS/Oppo especially) often replace or mute a channel's
 * custom sound, which is why a plain notification sound was not enough. This
 * service plays the file itself on the alarm stream, loops it with vibration,
 * and shows the ringing notification (full-screen, like an incoming call) as
 * its foreground notification.
 *
 * Stops when the app is opened, when the order is handled (ORDER_RESOLVED /
 * DRIVER_OFFER_CLOSED push or in-app accept), or after MAX_RING_MS.
 * If Android refuses to start the service, OrderAlert falls back to the
 * notification-channel sound.
 */
public class RingService extends Service {
    static final String ACTION_RING = "com.krishnaleelagrand.admin.RING";
    /** Silent channel: the service plays the sound itself. */
    static final String CHANNEL_ID = "klg_order_ring_fg";
    static final int NOTIF_ID = 4711;
    private static final long MAX_RING_MS = 45_000L;
    private static final long[] VIBRATE_PATTERN = {0, 800, 400, 800, 400, 800, 1200};

    private static volatile RingService instance;
    private static final Handler main = new Handler(Looper.getMainLooper());

    /** Orders ringing now: key -> {title, body}. Last one is shown. */
    private final Map<String, String[]> ringing = new LinkedHashMap<>();
    private MediaPlayer player;
    private Vibrator vibrator;
    private final Runnable timeout = this::timeOut;

    /** Returns false when Android does not allow the service now (caller falls back). */
    static boolean start(Context ctx, String title, String body, String key) {
        Intent i = new Intent(ctx, RingService.class)
                .setAction(ACTION_RING)
                .putExtra("title", title)
                .putExtra("body", body)
                .putExtra("key", key);
        try {
            ContextCompat.startForegroundService(ctx, i);
            return true;
        } catch (Exception e) { // ForegroundServiceStartNotAllowedException, IllegalStateException
            return false;
        }
    }

    /** key == null stops every ring. Safe to call when nothing is ringing. */
    static void stop(String key) {
        main.post(() -> {
            RingService s = instance;
            if (s != null) s.remove(key);
        });
    }

    static boolean isRinging(String key) {
        RingService s = instance;
        return s != null && s.ringing.containsKey(key);
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Order ringing", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Ringing screen for new and assigned delivery orders (the app plays the ring)");
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setBypassDnd(true);
        nm.createNotificationChannel(ch);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !ACTION_RING.equals(intent.getAction())) {
            // Restarted by the system without an order: nothing to ring.
            if (ringing.isEmpty()) stopNow();
            return START_NOT_STICKY;
        }
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String key = intent.getStringExtra("key");
        if (key == null) key = "local";

        ensureChannel(this);
        ringing.remove(key);
        ringing.put(key, new String[]{title, body});
        Notification n = OrderAlert.buildRinging(this, CHANNEL_ID, title, body);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Exception e) {
            // Not allowed to run in the foreground right now: ring through the notification sound.
            ringing.remove(key);
            OrderAlert.fallbackRing(getApplicationContext(), title, body, key);
            if (ringing.isEmpty()) stopNow();
            return START_NOT_STICKY;
        }
        playSound();
        main.removeCallbacks(timeout);
        main.postDelayed(timeout, MAX_RING_MS);
        return START_NOT_STICKY;
    }

    private void playSound() {
        if (player == null) {
            try {
                MediaPlayer p = new MediaPlayer();
                p.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM) // plays in silent mode, on alarm volume
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                p.setDataSource(this, OrderAlert.soundUri(this));
                p.setLooping(true);
                p.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
                p.prepare();
                p.start();
                player = p;
            } catch (Exception ignored) {
                player = null;
            }
        }
        if (vibrator == null) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createWaveform(VIBRATE_PATTERN, 0),
                            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
                } else {
                    v.vibrate(VIBRATE_PATTERN, 0);
                }
                vibrator = v;
            }
        }
    }

    private void remove(String key) {
        if (key == null) ringing.clear();
        else ringing.remove(key);
        if (ringing.isEmpty()) {
            stopNow();
            return;
        }
        // Another order is still ringing: show that one.
        String[] last = null;
        for (String[] v : ringing.values()) last = v;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        try { nm.notify(NOTIF_ID, OrderAlert.buildRinging(this, CHANNEL_ID, last[0], last[1])); } catch (Exception ignored) {}
    }

    /** Nobody answered: stop the sound, leave a silent notification per order. */
    private void timeOut() {
        for (String[] v : ringing.values()) OrderAlert.showQuiet(getApplicationContext(), v[0], v[1]);
        ringing.clear();
        stopNow();
    }

    private void stopNow() {
        main.removeCallbacks(timeout);
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            player.release();
            player = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        main.removeCallbacks(timeout);
        if (player != null) { try { player.release(); } catch (Exception ignored) {} player = null; }
        if (vibrator != null) { vibrator.cancel(); vibrator = null; }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
