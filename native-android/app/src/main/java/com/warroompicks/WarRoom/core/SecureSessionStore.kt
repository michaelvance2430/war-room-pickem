package com.warroompicks.WarRoom.core

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.warroompicks.WarRoom.model.UserSession
import java.util.UUID

class SecureSessionStore(context: Context) {
    private val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "war_room_session",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun read(): UserSession? = runCatching {
        UserSession(
            userId = UUID.fromString(prefs.getString("user_id", null)),
            email = prefs.getString("email", "") ?: "",
            accessToken = prefs.getString("access_token", null)!!,
            refreshToken = prefs.getString("refresh_token", null)!!,
            expiresAtEpochSeconds = prefs.getLong("expires_at", 0),
        )
    }.getOrNull()

    fun write(session: UserSession) {
        prefs.edit()
            .putString("user_id", session.userId.toString())
            .putString("email", session.email)
            .putString("access_token", session.accessToken)
            .putString("refresh_token", session.refreshToken)
            .putLong("expires_at", session.expiresAtEpochSeconds)
            .apply()
    }

    fun clear() = prefs.edit().clear().apply()
}
