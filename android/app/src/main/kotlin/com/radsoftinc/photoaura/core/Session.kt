package com.radsoftinc.photoaura.core

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Auth state for the whole app — the Android twin of iOS AuthStore. */
object Session {
    private lateinit var prefs: SharedPreferences
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    var user: CurrentUser? by mutableStateOf(null)
        private set
    var ready by mutableStateOf(false)
        private set

    val isClient: Boolean get() = user?.role == null || user?.role == "client"

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = try {
            val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            EncryptedSharedPreferences.create(
                context, "session", key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        } catch (e: Exception) {
            // keystore trouble after a restore — start signed out rather than crash
            context.getSharedPreferences("session_fallback", Context.MODE_PRIVATE)
        }
        Api.onUnauthorized = { scope.launch { if (user != null) signOut() } }

        val token = prefs.getString(KEY_TOKEN, null)
        val saved = prefs.getString(KEY_USER, null)?.let {
            try { Api.json.decodeFromString(CurrentUser.serializer(), it) } catch (e: Exception) { null }
        }
        if (token != null && saved != null) {
            Api.token = token
            user = saved
            // a token can go stale while the app sleeps; a 401 here signs out
            scope.launch { runCatching { withContext(Dispatchers.IO) { Api.verifyToken() } } }
        }
        ready = true
    }

    fun signIn(auth: AuthResponse) {
        prefs.edit()
            .putString(KEY_TOKEN, auth.accessToken)
            .putString(KEY_USER, Api.json.encodeToString(CurrentUser.serializer(), auth.user))
            .apply()
        Api.token = auth.accessToken
        user = auth.user
    }

    fun update(u: CurrentUser) {
        prefs.edit().putString(KEY_USER, Api.json.encodeToString(CurrentUser.serializer(), u)).apply()
        user = u
    }

    fun signOut() {
        prefs.edit().clear().apply()
        Api.token = null
        user = null
    }

    private const val KEY_TOKEN = "token"
    private const val KEY_USER = "user"
}
