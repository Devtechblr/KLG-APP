package com.krishnaleelagrand.admin;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Receives the KLG backend's data-only pushes (utils/pushNotificationService.js):
 *   { type: "NEW_ORDER", orderId, title, body }  -> ring + heads-up notification
 *   { type: "ORDER_RESOLVED", orderId }          -> stop the ring for that order
 *   { type: "DRIVER_OFFER", orderId, title, body } -> driver phone: ring for an offer
 *   { type: "DRIVER_OFFER_CLOSED", orderId }       -> driver phone: offer gone, stop
 * Works with the app closed, because FCM wakes this service directly.
 */
public class KlgMessagingService extends FirebaseMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        if (!PushPrefs.enabled(this)) return;
        final String endpoint = PushPrefs.endpoint(this);
        final String auth = PushPrefs.auth(this);
        new Thread(() -> PushPrefs.register(endpoint, token, auth)).start();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        if (!PushPrefs.enabled(this)) return;
        Map<String, String> data = message.getData();
        String type = data.get("type");
        String orderId = data.get("orderId");
        if ("NEW_ORDER".equals(type) || "DRIVER_OFFER".equals(type)) {
            if (orderId != null && !OrderAlert.firstAlertFor(orderId)) return; // app already rang for it
            String title = data.containsKey("title") ? data.get("title") : "New delivery order";
            String body = data.containsKey("body") ? data.get("body") : (orderId != null ? "Order " + orderId : "");
            OrderAlert.show(getApplicationContext(), title, body, true, orderId);
        } else if ("ORDER_RESOLVED".equals(type) || "DRIVER_OFFER_CLOSED".equals(type)) {
            OrderAlert.stopRing(getApplicationContext(), orderId);
        }
    }
}
