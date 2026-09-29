package com.radsoftinc.photoaura.core

import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Puts photos and videos in the phone's gallery, under Pictures/PhotoAura. */
object PhotoSaver {
    const val ALBUM = "PhotoAura"

    /** Android 9 and older need the storage permission to write to Pictures. */
    val needsLegacyPermission: Boolean get() = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q

    suspend fun save(context: Context, url: String, filename: String, mime: String?) = withContext(Dispatchers.IO) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20_000
            readTimeout = 60_000
        }
        try {
            if (conn.responseCode !in 200..299) throw ApiException(conn.responseCode, "Couldn't download the photo.")
            val type = mime ?: conn.contentType ?: "image/jpeg"
            val video = type.startsWith("video/")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val collection = if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                    put(MediaStore.MediaColumns.MIME_TYPE, type)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, (if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES) + "/$ALBUM")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val item = resolver.insert(collection, values) ?: throw ApiException(0, "Couldn't save to your gallery.")
                try {
                    resolver.openOutputStream(item)!!.use { out -> conn.inputStream.use { it.copyTo(out) } }
                    values.clear()
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                    resolver.update(item, values, null, null)
                } catch (e: Exception) {
                    resolver.delete(item, null, null)
                    throw e
                }
            } else {
                @Suppress("DEPRECATION")
                val dir = File(Environment.getExternalStoragePublicDirectory(
                    if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES), ALBUM)
                dir.mkdirs()
                val file = File(dir, filename)
                file.outputStream().use { out -> conn.inputStream.use { it.copyTo(out) } }
                android.media.MediaScannerConnection.scanFile(context, arrayOf(file.path), arrayOf(type), null)
            }
        } finally {
            conn.disconnect()
        }
    }

    /** The system downloader shows its own progress notification and lands the zip in Downloads. */
    fun downloadZip(context: Context, url: String, filename: String): Long {
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val req = DownloadManager.Request(Uri.parse(url))
            .setTitle(filename)
            .setDescription("PhotoAura gallery")
            .setMimeType("application/zip")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
        return dm.enqueue(req)
    }

    /** Stills get the full original; videos are presigned and already the original. */
    fun originalUrl(p: Photo) = if (p.isVideo) p.image else ImageUrls.original(p.image)
}
