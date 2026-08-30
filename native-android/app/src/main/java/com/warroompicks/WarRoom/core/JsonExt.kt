package com.warroompicks.WarRoom.core

import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.stringOrNull(key: String): String? = if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }
fun JSONObject.intOrZero(key: String): Int = if (isNull(key)) 0 else optInt(key)
fun JSONObject.arrayOrEmpty(key: String): JSONArray = optJSONArray(key) ?: JSONArray()
fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull(::optJSONObject)
