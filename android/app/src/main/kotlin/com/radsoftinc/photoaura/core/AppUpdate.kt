package com.radsoftinc.photoaura.core

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.radsoftinc.photoaura.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class AppConfig(val ios: AppPolicy? = null, val android: AppPolicy? = null)

@Serializable
data class AppPolicy(
    val minVersion: String? = null,
    val latestVersion: String? = null,
    val storeUrl: String? = null,
    val message: String? = null,
    val updatedAt: String? = null,
)

/** The studio's update policy: below min_version the app is blocked, below latest it nudges once. */
object AppUpdate {
    private const val PACKAGE = "com.radsoftinc.photoaura"
    private const val HOUR = 60 * 60 * 1000L

    private var prefs: SharedPreferences? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var lastCheck = 0L
    private var lastBase: String? = null
    private var inFlight = false

    var required by mutableStateOf<AppPolicy?>(null)
        private set
    var suggested by mutableStateOf<AppPolicy?>(null)
        private set

    fun init(context: Context) {
        prefs = context.getSharedPreferences("app_update", Context.MODE_PRIVATE)
    }

    /** Launch and every return to the foreground; at most hourly per studio. */
    fun check(current: String = BuildConfig.VERSION_NAME) {
        val base = Api.BASE
        val now = System.currentTimeMillis()
        if (inFlight || (base == lastBase && now - lastCheck < HOUR)) return
        inFlight = true
        scope.launch {
            // a failed check never blocks anyone, so errors just leave things as they were
            val policy = runCatching { Api.appConfig() }.getOrNull()
            inFlight = false
            if (policy == null) return@launch
            lastBase = base
            lastCheck = now
            apply(policy.android, current)
        }
    }

    private fun apply(p: AppPolicy?, current: String) {
        val min = p?.minVersion?.takeIf { it.isNotBlank() }
        val latest = p?.latestVersion?.takeIf { it.isNotBlank() }
        required = p?.takeIf { min != null && compare(current, min) < 0 }
        suggested = p?.takeIf {
            required == null && latest != null && compare(current, latest) < 0 &&
                prefs?.getString(KEY_DISMISSED, null) != latest
        }
    }

    fun dismissSuggestion() {
        suggested?.latestVersion?.let { prefs?.edit()?.putString(KEY_DISMISSED, it)?.apply() }
        suggested = null
    }

    /** 2.10 is newer than 2.9; missing parts count as 0 and a suffix like "-debug" is ignored. */
    fun compare(a: String, b: String): Int {
        fun parts(v: String) = v.trim().split('.').map { it.takeWhile(Char::isDigit).toIntOrNull() ?: 0 }
        val x = parts(a)
        val y = parts(b)
        for (i in 0 until maxOf(x.size, y.size)) {
            val d = x.getOrElse(i) { 0 }.compareTo(y.getOrElse(i) { 0 })
            if (d != 0) return d
        }
        return 0
    }

    fun openStore(context: Context, storeUrl: String?) {
        val tries = listOfNotNull(
            storeUrl?.takeIf { it.isNotBlank() },
            "market://details?id=$PACKAGE",
            "https://play.google.com/store/apps/details?id=$PACKAGE",
        )
        for (url in tries) {
            try {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return
            } catch (e: ActivityNotFoundException) {
                continue
            }
        }
    }

    private const val KEY_DISMISSED = "dismissed_latest"
}
