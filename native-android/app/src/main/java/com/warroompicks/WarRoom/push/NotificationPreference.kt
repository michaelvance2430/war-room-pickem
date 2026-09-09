package com.warroompicks.WarRoom.push

import android.content.Context

object NotificationPreference {
    private const val FILE = "war_room_push"
    private const val ENABLED = "notifications_enabled"
    private const val PENDING_TOKEN = "pending_fcm_token"
    private const val REGISTERED_TOKEN = "registered_fcm_token"

    fun isEnabled(context: Context): Boolean = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        .let { preferences -> if (preferences.contains(ENABLED)) preferences.getBoolean(ENABLED, true) else true }
    fun setEnabled(context: Context, enabled: Boolean) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, enabled).apply()
    fun pendingToken(context: Context): String? = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(PENDING_TOKEN, null)
    fun registeredToken(context: Context): String? = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(REGISTERED_TOKEN, null)
    fun savePendingToken(context: Context, token: String) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(PENDING_TOKEN, token).apply()
    fun markRegistered(context: Context, token: String) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(REGISTERED_TOKEN, token).remove(PENDING_TOKEN).apply()
    fun clearTokens(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().remove(PENDING_TOKEN).remove(REGISTERED_TOKEN).apply()
}
