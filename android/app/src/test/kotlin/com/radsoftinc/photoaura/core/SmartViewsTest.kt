package com.radsoftinc.photoaura.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SmartViewsTest {
    private val json = Api.json

    private fun photoJson(name: String) =
        """{"image":"https://cdn.example/$name","compressed_image":"https://cdn.example/c/$name","file_metadata":{"filename":"$name"}}"""

    private fun albumJson(extra: String = "") =
        """{"album_name":"Sample","slug":"sample","image_count":4,"album_photos":[${listOf("a.jpg", "b.jpg", "c.jpg", "d.jpg").joinToString(",") { photoJson(it) }}]$extra}"""

    private fun photo(name: String) = json.decodeFromString<Photo>(photoJson(name))

    @Test
    fun oldServerDecodesWithoutSmartFields() {
        val d = json.decodeFromString<AlbumDetail>(albumJson())
        assertNull(d.highlights)
        assertNull(d.moments)
        assertEquals(false, d.smartPublished)
        assertEquals(listOf(GalleryView.All), d.availableViews())
    }

    @Test
    fun nullSmartFieldsDecode() {
        val d = json.decodeFromString<AlbumDetail>(albumJson(""","highlights":null,"smart_published":false,"moments":null"""))
        assertNull(d.highlights)
        assertNull(d.moments)
        assertEquals(listOf(GalleryView.All), d.availableViews())
    }

    @Test
    fun emptyListsAddNoChips() {
        val d = json.decodeFromString<AlbumDetail>(albumJson(""","highlights":[],"smart_published":true,"moments":[]"""))
        assertEquals(listOf(GalleryView.All), d.availableViews())
    }

    @Test
    fun publishedFieldsDecode() {
        val d = json.decodeFromString<AlbumDetail>(
            albumJson(
                ""","highlights":["a.jpg","c.jpg"],"smart_published":true,"moments":[
                {"key":"m1","label":"Cake cutting","start":"2026-03-01T16:12:00-05:00","end":"2026-03-01T16:40:00-05:00","count":2,"cover":"a.jpg","filenames":["a.jpg","b.jpg"]},
                {"key":"m2","label":"Dancing","filenames":["c.jpg"]}]""",
            ),
        )
        assertEquals(listOf("a.jpg", "c.jpg"), d.highlights)
        assertTrue(d.smartPublished)
        assertEquals(2, d.moments?.size)
        assertEquals("Cake cutting", d.moments?.first()?.label)
        assertNull(d.moments?.last()?.start)
        assertEquals(listOf(GalleryView.Highlights, GalleryView.All, GalleryView.Moments), d.availableViews())
        assertEquals(GalleryView.Highlights, d.availableViews().defaultView())
    }

    @Test
    fun defaultViewFallsBackToAll() {
        assertEquals(GalleryView.All, listOf(GalleryView.All, GalleryView.Moments).defaultView())
    }

    @Test
    fun highlightsKeepAlbumOrder() {
        val all = listOf("a.jpg", "b.jpg", "c.jpg", "d.jpg").map(::photo)
        val out = filterHighlights(all, listOf("d.jpg", "a.jpg"))
        assertEquals(listOf("a.jpg", "d.jpg"), out.map { it.fileMetadata.filename })
        assertEquals(all, filterHighlights(all, null))
    }

    @Test
    fun sectionsFollowMomentOrderAndDropMissing() {
        val all = listOf("a.jpg", "b.jpg", "c.jpg").map(::photo)
        val moments = listOf(
            Moment("m1", "One", filenames = listOf("b.jpg", "a.jpg", "gone.jpg")),
            Moment("m2", "Two", filenames = listOf("gone.jpg")),
            Moment("m3", "Three", filenames = listOf("c.jpg")),
        )
        val sections = momentSections(all, moments)
        assertEquals(listOf("m1", "m3"), sections.map { it.key })
        assertEquals(listOf("b.jpg", "a.jpg"), sections[0].photos.map { it.fileMetadata.filename })
        assertTrue(momentSections(all, null).isEmpty())
    }

    @Test
    fun gridOffsetsAccountForHeaders() {
        val all = listOf("a.jpg", "b.jpg", "c.jpg").map(::photo)
        val sections = momentSections(
            all,
            listOf(Moment("m1", filenames = listOf("a.jpg", "b.jpg")), Moment("m2", filenames = listOf("c.jpg"))),
        )
        assertEquals(listOf(0, 3), momentHeaderOffsets(sections))
        assertEquals(1, momentTileOffset(sections, 0))
        assertEquals(2, momentTileOffset(sections, 1))
        assertEquals(4, momentTileOffset(sections, 2))
    }

    @Test
    fun rangeReadsWallClock() {
        assertEquals("4:12 PM–4:40 PM", formatMomentRange("2026-03-01T16:12:00-05:00", "2026-03-01T16:40:00-05:00"))
        assertEquals("9:05 AM–10:00 AM", formatMomentRange("2026-03-01T09:05:00", "2026-03-01T10:00:00"))
        assertEquals("9:05 AM", formatMomentRange("2026-03-01T09:05:00", "2026-03-01T09:05:30"))
        assertNull(formatMomentRange(null, "2026-03-01T10:00:00"))
        assertNull(formatMomentRange("nope", "2026-03-01T10:00:00"))
    }

    @Test
    fun titleSkipsMissingParts() {
        assertEquals("Cake cutting · 4:12 PM–4:40 PM · 24", momentTitle("Cake cutting", "4:12 PM–4:40 PM", 24))
        assertEquals("Dancing · 3", momentTitle("Dancing", null, 3))
        assertEquals("3", momentTitle("", null, 3))
    }
}
