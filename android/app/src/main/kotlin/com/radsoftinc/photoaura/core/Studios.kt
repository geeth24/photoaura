package com.radsoftinc.photoaura.core

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.serialization.Serializable
import java.util.UUID

/** One photography business on PhotoAura, with its own backend. */
@Serializable
data class Studio(
    val id: String,
    val name: String,
    val apiUrl: String,
    val builtIn: Boolean = false,
) {
    val host: String get() = runCatching { java.net.URI(apiUrl).host }.getOrNull() ?: apiUrl

    companion object {
        val reactiveShots = Studio("reactive-shots", "Reactive Shots", "https://aura-api.reactiveshots.com/api", builtIn = true)
    }
}

/** The studios on this device and which one sign-in talks to. */
object Studios {
    private val builtIn = listOf(Studio.reactiveShots)
    private var prefs: SharedPreferences? = null

    var custom by mutableStateOf(emptyList<Studio>())
        private set
    var selectedId by mutableStateOf(Studio.reactiveShots.id)
        private set

    val all: List<Studio> get() = builtIn + custom
    val selected: Studio get() = all.firstOrNull { it.id == selectedId } ?: Studio.reactiveShots

    fun init(context: Context) {
        val p = context.getSharedPreferences("studios", Context.MODE_PRIVATE)
        prefs = p
        custom = p.getString(KEY_CUSTOM, null)?.let {
            runCatching { Api.json.decodeFromString<List<Studio>>(it) }.getOrNull()
        } ?: emptyList()
        selectedId = p.getString(KEY_SELECTED, null) ?: Studio.reactiveShots.id
    }

    fun select(studio: Studio) {
        selectedId = studio.id
        prefs?.edit()?.putString(KEY_SELECTED, studio.id)?.apply()
    }

    fun add(name: String, apiUrl: String): Studio {
        val s = Studio("custom-" + UUID.randomUUID().toString().take(8), name, apiUrl.trimEnd('/'))
        custom = custom + s
        persist()
        return s
    }

    fun remove(studio: Studio) {
        if (studio.builtIn) return
        custom = custom.filter { it.id != studio.id }
        persist()
        if (selectedId == studio.id) select(Studio.reactiveShots)
    }

    private fun persist() {
        prefs?.edit()?.putString(KEY_CUSTOM, Api.json.encodeToString(custom))?.apply()
    }

    private const val KEY_CUSTOM = "custom"
    private const val KEY_SELECTED = "selected"
}
