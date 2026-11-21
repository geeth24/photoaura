package com.radsoftinc.photoaura.core

import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** The ways to slice an album: the studio's picks, everything, or the shoot in chapters. */
enum class GalleryView { Highlights, All, Moments }

/** One moment with its photos resolved, in capture order. */
data class MomentSection(val moment: Moment, val photos: List<Photo>) {
    val key: String get() = moment.key
}

private val clock = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

fun AlbumDetail.availableViews(): List<GalleryView> = buildList {
    if (!highlights.isNullOrEmpty()) add(GalleryView.Highlights)
    add(GalleryView.All)
    if (!moments.isNullOrEmpty()) add(GalleryView.Moments)
}

/** Highlights when the studio published them, otherwise everything. */
fun List<GalleryView>.defaultView(): GalleryView = if (GalleryView.Highlights in this) GalleryView.Highlights else GalleryView.All

fun filterHighlights(photos: List<Photo>, highlights: List<String>?): List<Photo> {
    val names = highlights?.toSet() ?: return photos
    return photos.filter { it.fileMetadata.filename in names }
}

/** Sections in moment order. Photos the viewer can't see (filtered out, not in the album) drop out, and so do empty sections. */
fun momentSections(photos: List<Photo>, moments: List<Moment>?): List<MomentSection> {
    if (moments.isNullOrEmpty()) return emptyList()
    val byName = photos.associateBy { it.fileMetadata.filename }
    return moments.mapNotNull { m ->
        val found = m.filenames.mapNotNull { byName[it] }
        if (found.isEmpty()) null else MomentSection(m, found)
    }
}

/** Grid item index of each section header, counting from the first section's header. */
fun momentHeaderOffsets(sections: List<MomentSection>): List<Int> {
    var at = 0
    return sections.map { s -> at.also { at += 1 + s.photos.size } }
}

/** Grid item index of the tile at `flatIndex` of the sections' photos laid end to end. */
fun momentTileOffset(sections: List<MomentSection>, flatIndex: Int): Int {
    var left = flatIndex
    sections.forEachIndexed { i, s ->
        if (left < s.photos.size) return flatIndex + i + 1
        left -= s.photos.size
    }
    return flatIndex + sections.size
}

/** "4:12 PM–4:40 PM", read as the wall-clock time the server sent. Null when either end doesn't parse. */
fun formatMomentRange(start: String?, end: String?): String? {
    val a = wallClock(start) ?: return null
    val b = wallClock(end) ?: return null
    val from = clock.format(a)
    val to = clock.format(b)
    return if (from == to) from else "$from–$to"
}

private fun wallClock(iso: String?): LocalDateTime? {
    if (iso.isNullOrBlank()) return null
    return runCatching { OffsetDateTime.parse(iso).toLocalDateTime() }.getOrNull()
        ?: runCatching { LocalDateTime.parse(iso) }.getOrNull()
}

fun momentTitle(label: String, range: String?, count: Int): String =
    listOfNotNull(label.ifBlank { null }, range, count.toString()).joinToString(" · ")
