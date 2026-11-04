package com.krishnaleelagrand.admin;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Receives the KLG backend's data-only pushes (utils/pushNotificationService.js):
 *   { type: "NEW_ORDER", orderId, title, body }  -> ring + heads-up notification
 *   { type: "ORDER_RESOLVED", orderId }          -> stop the ring for that order
 * Works with the app closed, because FCM wakes this service directly.
 */
public class KlgMessagingService extends FirebaseMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        if (!PushPrefs.enabled(this)) return;
        final String endpoint = PushPrefs.endpoint(this);
        new Thread(() -> PushPrefs.register(endpoint, token)).start();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        if (!PushPrefs.enabled(this)) return;
        Map<String, String> data = message.getData();
        String type = data.get("type");
        String orderId = data.get("orderId");
        if ("NEW_ORDER".equals(type)) {
            String title = data.containsKey("title") ? data.get("title") : "New delivery order";
            String body = data.containsKey("body") ? data.get("body") : (orderId != null ? "Order " + orderId : "");
            OrderAlert.startRing(getApplicationContext(), orderId);
            OrderAlert.show(getApplicationContext(), title, body);
        } else if ("ORDER_RESOLVED".equals(type)) {
            OrderAlert.stopRing(orderId);
        }
    }
}
