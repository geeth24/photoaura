package com.radsoftinc.photoaura.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

// shapes mirror the JSON the backend returns; the client decodes snake_case keys

@Serializable
data class CurrentUser(
    val id: Int,
    val userName: String? = null,
    val fullName: String = "",
    val userEmail: String = "",
    val role: String? = null,
)

@Serializable
data class AuthResponse(val accessToken: String, val user: CurrentUser)

@Serializable
data class AlbumSummary(
    val albumId: Int,
    val albumName: String,
    val slug: String,
    val imageCount: Int = 0,
    val albumPhotos: List<Photo>? = null,
) {
    val coverImage: String? get() = albumPhotos?.firstOrNull()?.compressedImage
}

@Serializable
data class AlbumDetail(
    val albumName: String,
    val slug: String,
    val imageCount: Int = 0,
    val albumPhotos: List<Photo> = emptyList(),
    // builds the shareable gallery link
    val secret: String? = null,
    val revision: AlbumRevision? = null,
)

/** A batch of re-edits pushed after delivery. The delivery itself is version 1, so the first is number 2. */
@Serializable
data class AlbumRevision(
    val number: Int = 0,
    val note: String? = null,
    val photoCount: Int = 0,
    val createdAt: String? = null,
    val notifiedAt: String? = null,
)

/** One stored edit of a photo, oldest first from /photo/{id}/versions. */
@Serializable
data class PhotoVersion(
    val version: Int = 1,
    val filename: String = "",
    val revisionNumber: Int? = null,
    val uploadedAt: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    val image: String = "",
    val compressedImage: String = "",
) {
    // lets the viewer's zoomable page show it like any other photo
    val photo: Photo get() = Photo(image, compressedImage, PhotoMetadata(filename, width ?: 0, height ?: 0, version = version))
}

@Serializable
data class Photo(
    val image: String,
    val compressedImage: String,
    val fileMetadata: PhotoMetadata,
) {
    val id: String get() = image
    val isVideo: Boolean get() = fileMetadata.contentType?.startsWith("video/") == true
}

@Serializable
data class PhotoMetadata(
    val filename: String,
    val width: Int = 0,
    val height: Int = 0,
    val orientation: String? = null,
    val size: Long? = null,
    val contentType: String? = null,
    val uploadDate: String? = null,
    // raw EXIF as a JSON string
    val exifData: String? = null,
    val id: Int? = null,
    val version: Int = 1,
    // the revision that last replaced this photo
    val revisionNumber: Int? = null,
) {
    /** EXIF as an object. Some uploads store it JSON-encoded twice, so a string gets one more pass. */
    val exif: JsonObject?
        get() {
            val raw = exifData ?: return null
            return try {
                when (val parsed = Json.parseToJsonElement(raw)) {
                    is JsonObject -> parsed
                    is JsonPrimitive -> parsed.contentOrNull?.let { Json.parseToJsonElement(it).jsonObject }
                    else -> null
                }
            } catch (e: Exception) {
                null
            }
        }

    /** When the shutter fired, from EXIF DateTimeOriginal. */
    val takenAt: LocalDateTime?
        get() {
            val e = exif ?: return null
            val s = (e["DateTimeOriginal"] as? JsonPrimitive)?.contentOrNull
                ?: (e["DateTime"] as? JsonPrimitive)?.contentOrNull
                ?: return null
            return try {
                LocalDateTime.parse(s, DateTimeFormatter.ofPattern("yyyy:MM:dd HH:mm:ss"))
            } catch (e: Exception) {
                null
            }
        }
}

@Serializable
data class FaceSummary(
    val faceId: String,
    val name: String? = null,
    val count: Int = 0,
    val imageUrl: String,
    val filenames: List<String> = emptyList(),
)

@Serializable
data class HomeSummary(
    val firstName: String? = null,
    val albums: List<HomeAlbum> = emptyList(),
    val files: List<ClientFile> = emptyList(),
    val totals: HomeTotals = HomeTotals(),
)

@Serializable
data class HomeTotals(val photos: Int = 0, val videos: Int = 0, val files: Int = 0)

@Serializable
data class HomeAlbum(
    val id: Int,
    val name: String,
    val slug: String,
    val date: String? = null,
    val photoCount: Int = 0,
    val videoCount: Int = 0,
    val cover: String? = null,
    val revision: AlbumRevision? = null,
) {
    // the album screen takes a summary; counts are all it needs from us
    val summary: AlbumSummary get() = AlbumSummary(id, name, slug, photoCount + videoCount)
}

@Serializable
data class ClientFile(
    val id: Int,
    val albumName: String? = null,
    val filename: String,
    val size: Long? = null,
    val contentType: String? = null,
    val createdAt: String? = null,
    val downloadUrl: String? = null,
)

@Serializable
data class FavoriteList(val filenames: List<String> = emptyList())

@Serializable
data class DownloadTicket(val ticket: String)
