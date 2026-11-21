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
    val isAdmin: Boolean get() = user?.role == "admin"

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
        Api.onUnauthorized = { scope.launch { if (user != null) endSession(logout = false) } }
        Api.onRefreshed = { r, base -> persistRefresh(r, base) }

        val token = prefs.getString(KEY_TOKEN, null)
        val saved = prefs.getString(KEY_USER, null)?.let {
            try { Api.json.decodeFromString(CurrentUser.serializer(), it) } catch (e: Exception) { null }
        }
        if (token != null && saved != null) {
            Api.setTokens(token, prefs.getString(KEY_REFRESH, null), prefs.getString(KEY_BASE, null))
            user = saved
            // a token can go stale while the app sleeps; a 401 here signs out
            scope.launch { runCatching { withContext(Dispatchers.IO) { Api.verifyToken() } } }
        }
        ready = true
    }

    fun signIn(auth: AuthResponse) {
        // refresh tokens belong to the server that issued them, and studios can differ
        val base = Api.BASE
        prefs.edit()
            .putString(KEY_TOKEN, auth.accessToken)
            .putString(KEY_USER, Api.json.encodeToString(CurrentUser.serializer(), auth.user))
            .putString(KEY_REFRESH, auth.refreshToken)
            .putString(KEY_BASE, base)
            .apply()
        Api.setTokens(auth.accessToken, auth.refreshToken, base)
        user = auth.user
    }

    private fun persistRefresh(r: RefreshResponse, base: String?) {
        val edit = prefs.edit().putString(KEY_TOKEN, r.accessToken)
        r.refreshToken?.let { edit.putString(KEY_REFRESH, it) }
        r.user?.let { edit.putString(KEY_USER, Api.json.encodeToString(CurrentUser.serializer(), it)) }
        edit.putString(KEY_BASE, base).apply()
        r.user?.let { scope.launch { user = it } }
    }

    /** Call when the app comes to the foreground so a stale access token is renewed before it's needed. */
    fun refreshIfExpiring() {
        if (user == null) return
        scope.launch { runCatching { withContext(Dispatchers.IO) { Api.refreshIfExpiring() } } }
    }

    fun update(u: CurrentUser) {
        prefs.edit().putString(KEY_USER, Api.json.encodeToString(CurrentUser.serializer(), u)).apply()
        user = u
    }

    fun signOut() = endSession(logout = true)

    private fun endSession(logout: Boolean) {
        val refresh = Api.refreshToken
        val base = Api.tokenBase
        prefs.edit().clear().apply()
        Api.setTokens(null, null, null)
        user = null
        if (logout && refresh != null && base != null) {
            scope.launch(Dispatchers.IO) { Api.logout(refresh, base) }
        }
    }

    private const val KEY_TOKEN = "token"
    private const val KEY_USER = "user"
    private const val KEY_REFRESH = "refresh_token"
    private const val KEY_BASE = "token_base"
}
