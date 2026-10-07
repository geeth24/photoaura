package com.radsoftinc.photoaura.core

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Contracts and invoices: fetched with the session token, then handed to a PDF viewer. */
object Documents {
    suspend fun openPdf(context: Context, filename: String, fetch: suspend () -> ByteArray) {
        val bytes = fetch()
        val uri = withContext(Dispatchers.IO) {
            val dir = File(context.cacheDir, "share").apply { mkdirs() }
            val f = File(dir, filename)
            f.writeBytes(bytes)
            FileProvider.getUriForFile(context, "${context.packageName}.files", f)
        }
        val view = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/pdf")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(view)
        } catch (e: ActivityNotFoundException) {
            // no PDF viewer installed; the share sheet can still save it to Files or Drive
            val send = Intent(Intent.ACTION_SEND)
                .setType("application/pdf")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            context.startActivity(Intent.createChooser(send, filename).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}
