package com.israeltoknt.app;

import android.app.Application;

public class YoruApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        Notifier.createChannels(this);
        PushSetup.startFirebase(this);
        NotifyWorker.schedule(this);
    }
}
