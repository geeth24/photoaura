package com.radsoftinc.photoaura.core

import android.net.Uri
import android.util.Base64

/**
 * The CDN serves resized copies under /fit-in/WxH/{slug}/{file}; the same path
 * without that prefix is the original. Presigned S3 URLs (videos) pass through.
 */
object ImageUrls {
    private const val CDN_HOST = "aura-cdn.reactiveshots.com"
    private const val BUCKET = "photoaura"
    private val fitIn = Regex("^/fit-in/\\d+x\\d+/")

    fun original(url: String): String {
        val uri = Uri.parse(url)
        val path = uri.encodedPath ?: return url
        val m = fitIn.find(path) ?: return url
        return uri.buildUpon().encodedPath("/" + path.substring(m.range.last + 1)).build().toString()
    }

    /** ~2560px web copy, stills only. */
    fun optimized(url: String, width: Int = 2560): String {
        val uri = Uri.parse(original(url))
        return uri.buildUpon().encodedPath("/fit-in/${width}x0" + uri.encodedPath).build().toString()
    }

    /**
     * EXIF-upright resize through the image handler's edits form. Widths must match
     * the warmer's and the JSON must match the web loader byte for byte, or every
     * request misses the warmed CloudFront copy.
     */
    fun upright(url: String, width: Int): String {
        val uri = Uri.parse(original(url))
        if (uri.host != CDN_HOST) return uri.toString()
        val key = Uri.decode(uri.encodedPath?.removePrefix("/") ?: return uri.toString())
        if (key.isEmpty()) return uri.toString()
        val json = """{"bucket":"$BUCKET","key":${jsonString(key)},"edits":{"rotate":null,"resize":{"width":$width,"fit":"inside"}}}"""
        val token = Base64.encodeToString(json.toByteArray(), Base64.NO_WRAP)
        return "https://$CDN_HOST/$token"
    }

    // quote like JSON.stringify: escape quotes and backslashes, leave slashes alone
    private fun jsonString(s: String): String {
        val b = StringBuilder("\"")
        for (c in s) when (c) {
            '"' -> b.append("\\\"")
            '\\' -> b.append("\\\\")
            '\n' -> b.append("\\n")
            '\r' -> b.append("\\r")
            '\t' -> b.append("\\t")
            else -> if (c < ' ') b.append(String.format("\\u%04x", c.code)) else b.append(c)
        }
        return b.append('"').toString()
    }

    const val TILE = 750
    const val FULL = 2048
    fun tile(p: Photo) = upright(p.compressedImage, TILE)
    fun full(p: Photo) = upright(p.image, FULL)
}
