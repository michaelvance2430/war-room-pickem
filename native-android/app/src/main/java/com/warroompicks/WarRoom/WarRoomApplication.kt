package com.warroompicks.WarRoom

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging

class WarRoomApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("war_room_live", "War Room Live", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Cards, lock warnings, announcements, and official results"
        })
        if (BuildConfig.FIREBASE_APPLICATION_ID.isNotBlank() && FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this, FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FIREBASE_APPLICATION_ID)
                .setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                .build())
        }
        if (FirebaseApp.getApps(this).isNotEmpty()) {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                getSharedPreferences("war_room_push", MODE_PRIVATE)
                    .edit()
                    .putString("pending_fcm_token", token)
                    .apply()
            }
        }
    }
}
