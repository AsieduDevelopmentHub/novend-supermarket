package com.novend.pos;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public MainActivity() {
        registerPlugin(NovendPermissionsPlugin.class);
    }
}
