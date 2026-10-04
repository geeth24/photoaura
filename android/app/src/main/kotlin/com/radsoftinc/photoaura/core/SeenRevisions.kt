package com.radsoftinc.photoaura.core

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.mutableStateMapOf

/** The latest revision the client has opened, per album, so home can flag new ones. */
object SeenRevisions {
    private var prefs: SharedPreferences? = null
    private val seen = mutableStateMapOf<String, Int>()

    fun init(context: Context) {
        val p = context.getSharedPreferences("seen_revisions", Context.MODE_PRIVATE)
        prefs = p
        p.all.forEach { (slug, n) -> if (n is Int) seen[slug] = n }
    }

    fun isNew(slug: String, revision: AlbumRevision?): Boolean =
        revision != null && revision.number > (seen[slug] ?: 0)

    fun markSeen(slug: String, revision: AlbumRevision?) {
        val n = revision?.number ?: return
        if ((seen[slug] ?: 0) >= n) return
        seen[slug] = n
        prefs?.edit()?.putInt(slug, n)?.apply()
    }
}
