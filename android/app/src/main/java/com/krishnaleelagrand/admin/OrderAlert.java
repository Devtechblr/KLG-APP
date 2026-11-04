package com.krishnaleelagrand.admin;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationCompat;

/**
 * Heads-up notification + looping ring for order alerts. Same behaviour as the
 * KLG Admin wrapper app: native MediaPlayer on res/raw/order_alert.wav, alarm
 * audio stream, phone-call style vibration, auto-stop after MAX_RING_MS.
 */
public final class OrderAlert {
    static final String CHANNEL_ID = "klg_order_alerts";
    private static final long MAX_RING_MS = 45_000L;
    private static final long[] VIBRATE_PATTERN = {0, 800, 400};

    private static MediaPlayer player;
    private static Vibrator vibrator;
    private static String ringingKey;
    private static final Handler handler = new Handler(Looper.getMainLooper());
    private static Runnable stopTask;

    private OrderAlert() {}

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Delivery order alerts", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("New, assigned and cancelled delivery orders");
        ch.enableVibration(true);
        ch.setSound(null, null); // we play our own ring
        nm.createNotificationChannel(ch);
    }

    static void show(Context ctx, String title, String body) {
        ensureChannel(ctx);
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(pi);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            nm.notify((int) (System.currentTimeMillis() & 0x7fffffff), b.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS denied on Android 13+: the ring still plays.
        }
    }

    static synchronized void startRing(Context ctx, String key) {
        stopRing(null);
        ringingKey = key;
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            android.content.res.AssetFileDescriptor afd = ctx.getResources().openRawResourceFd(R.raw.order_alert);
            player.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception ignored) {
            player = null;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                vibrator = ((VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)).getDefaultVibrator();
            } else {
                vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(VIBRATE_PATTERN, 0));
            } else {
                vibrator.vibrate(VIBRATE_PATTERN, 0);
            }
        } catch (Exception ignored) {
            vibrator = null;
        }
        final String k = key;
        stopTask = () -> stopRing(k);
        handler.postDelayed(stopTask, MAX_RING_MS);
    }

    /** key == null stops whatever is ringing; otherwise only that order's ring. */
    static synchronized void stopRing(String key) {
        if (key != null && ringingKey != null && !key.equals(ringingKey)) return;
        if (stopTask != null) handler.removeCallbacks(stopTask);
        stopTask = null;
        if (player != null) {
            try { if (player.isPlaying()) player.stop(); } catch (Exception ignored) {}
            player.release();
            player = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
        ringingKey = null;
    }
}
