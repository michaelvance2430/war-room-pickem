package com.warroompicks.WarRoom.push

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.warroompicks.WarRoom.MainActivity
import com.warroompicks.WarRoom.R

class WarRoomMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences("war_room_push", MODE_PRIVATE).edit().putString("pending_fcm_token", token).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val destination = message.data["destination"] ?: "home"
        val intent = Intent(this, MainActivity::class.java).putExtra("notification_destination", destination)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(this, destination.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, "war_room_live")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(message.notification?.title ?: "War Room Pick'em")
            .setContentText(message.notification?.body ?: "New intelligence is available.")
            .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(pending).build()
        NotificationManagerCompat.from(this).notify(message.messageId?.hashCode() ?: System.currentTimeMillis().toInt(), notification)
    }
}
