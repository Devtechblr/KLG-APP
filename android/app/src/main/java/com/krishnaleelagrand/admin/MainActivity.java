package com.krishnaleelagrand.admin;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KlgNativePlugin.class);
        super.onCreate(savedInstanceState);
        OrderAlert.ensureChannel(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Opening the app answers the alert.
        OrderAlert.stopRing(null);
    }
}
