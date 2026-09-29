package com.radsoftinc.photoaura.features.gallery

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.FolderZip
import androidx.compose.material.icons.outlined.SaveAlt
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialButtonStyle
import com.radsoftinc.editorialstyle.EditorialCard
import com.radsoftinc.editorialstyle.EditorialEyebrow
import com.radsoftinc.editorialstyle.EditorialProgressBar
import com.radsoftinc.editorialstyle.EditorialSheet
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.Photo
import com.radsoftinc.photoaura.core.PhotoSaver
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.ui.ActionCard
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private enum class Phase { Idle, Saving, Finished }

/** One place for "I want these photos" — the thing clients open the app for. */
@Composable
fun GalleryActionsSheet(
    albumName: String,
    slug: String,
    secret: String?,
    photos: List<Photo>,
    onDismiss: () -> Unit,
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var phase by remember { mutableStateOf(Phase.Idle) }
    var saved by remember { mutableIntStateOf(0) }
    var failed by remember { mutableIntStateOf(0) }
    var job by remember { mutableStateOf<Job?>(null) }
    var zipStarting by remember { mutableStateOf(false) }
    val stills = remember(photos) { photos.filter { !it.isVideo } }
    DisposableEffect(Unit) { onDispose { job?.cancel() } }

    fun startSave() {
        phase = Phase.Saving
        saved = 0; failed = 0
        job = scope.launch {
            for (p in photos) {
                if (!isActive) return@launch
                val ok = runCatching {
                    PhotoSaver.save(ctx, PhotoSaver.originalUrl(p), p.fileMetadata.filename, p.fileMetadata.contentType)
                }.isSuccess
                if (ok) saved++ else failed++
            }
            phase = Phase.Finished
        }
    }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) startSave()
    }

    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    EditorialSheet(onDismiss, title = "Get your photos", verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            EditorialEyebrow("Gallery")
            Text(albumName, style = type.heading, color = c.textPrimary)
            val videos = photos.size - stills.size
            Text(
                "${stills.size} photo${if (stills.size == 1) "" else "s"}" + if (videos > 0) " · $videos video${if (videos == 1) "" else "s"}" else "",
                style = type.subtitle, color = c.textMuted,
            )
        }

        when (phase) {
            Phase.Idle -> {
                ActionCard(Icons.Outlined.SaveAlt, "Save all to your gallery", "Straight into Photos, full quality", chevron, prominent = true) {
                    if (PhotoSaver.needsLegacyPermission &&
                        ContextCompat.checkSelfPermission(ctx, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
                    ) permission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE) else startSave()
                }
                ActionCard(Icons.Outlined.Share, "Share the gallery", "Send a link on WhatsApp, Messages, anywhere", chevron) {
                    val send = Intent(Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(Intent.EXTRA_TEXT, Api.shareUrl(slug, secret))
                        .putExtra(Intent.EXTRA_SUBJECT, albumName)
                    ctx.startActivity(Intent.createChooser(send, null))
                }
                ActionCard(
                    Icons.Outlined.FolderZip,
                    if (zipStarting) "Starting download…" else "Download as a zip",
                    "Full-size originals, saved to Downloads",
                    chevron,
                ) {
                    if (zipStarting) return@ActionCard
                    zipStarting = true
                    scope.launch {
                        runCatching {
                            val ticket = Api.downloadTicket(slug)
                            PhotoSaver.downloadZip(ctx, Api.zipUrl(slug, ticket), "$slug.zip")
                        }.onSuccess {
                            android.widget.Toast.makeText(ctx, "Downloading — check your notifications", android.widget.Toast.LENGTH_LONG).show()
                        }.onFailure {
                            android.widget.Toast.makeText(ctx, it.friendly(), android.widget.Toast.LENGTH_LONG).show()
                        }
                        zipStarting = false
                    }
                }
            }
            Phase.Saving -> {
                val total = photos.size
                EditorialCard(padding = PaddingValues(EditorialSpacing.large), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text("Saving to your gallery", style = type.serif(24.sp), color = c.textPrimary)
                    EditorialProgressBar(
                        progress = if (total == 0) 0f else (saved + failed).toFloat() / total,
                        stage = "Saving",
                        detail = "${saved + failed} of $total",
                    )
                    EditorialButton("Stop", { job?.cancel(); phase = Phase.Finished }, style = EditorialButtonStyle.Secondary)
                }
            }
            Phase.Finished -> {
                EditorialCard(padding = PaddingValues(EditorialSpacing.large)) {
                    Icon(Icons.Outlined.CheckCircle, null, Modifier.size(28.dp), tint = c.success)
                    Text(
                        if (failed == 0) "All $saved saved" else "$saved saved, $failed didn't",
                        style = type.serif(24.sp), color = c.textPrimary,
                    )
                    Text("They're in your gallery app under the ${PhotoSaver.ALBUM} album.", style = type.subtitle, color = c.textMuted)
                    EditorialButton("Done", onDismiss)
                }
            }
        }
    }
}

private val chevron = Icons.AutoMirrored.Outlined.KeyboardArrowRight
