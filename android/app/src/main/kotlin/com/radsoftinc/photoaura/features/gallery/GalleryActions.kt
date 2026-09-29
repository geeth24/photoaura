package com.radsoftinc.photoaura.features.gallery

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.FolderZip
import androidx.compose.material.icons.outlined.SaveAlt
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.Photo
import com.radsoftinc.photoaura.core.PhotoSaver
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.ui.BrandButton
import com.radsoftinc.photoaura.ui.Eyebrow
import com.radsoftinc.photoaura.ui.SecondaryButton
import com.radsoftinc.photoaura.ui.Type
import com.radsoftinc.photoaura.ui.aura
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private enum class Phase { Idle, Saving, Finished }

/** One place for "I want these photos" — the thing clients open the app for. */
@OptIn(ExperimentalMaterial3Api::class)
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

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = aura.background,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 36.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Get your photos", style = Type.serif(20), color = aura.textPrimary, modifier = Modifier.align(Alignment.CenterHorizontally))
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Eyebrow("Gallery", color = aura.brand, line = false)
                Text(albumName, style = Type.serif(28), color = aura.textPrimary)
                val videos = photos.size - stills.size
                Text(
                    "${stills.size} photo${if (stills.size == 1) "" else "s"}" + if (videos > 0) " · $videos video${if (videos == 1) "" else "s"}" else "",
                    style = Type.sans(15), color = aura.textMuted,
                )
            }

            when (phase) {
                Phase.Idle -> {
                    ActionRow(Icons.Outlined.SaveAlt, "Save all to your gallery", "Straight into Photos, full quality", prominent = true) {
                        if (PhotoSaver.needsLegacyPermission &&
                            ContextCompat.checkSelfPermission(ctx, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
                        ) permission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE) else startSave()
                    }
                    ActionRow(Icons.Outlined.Share, "Share the gallery", "Send a link on WhatsApp, Messages, anywhere") {
                        val send = Intent(Intent.ACTION_SEND).setType("text/plain")
                            .putExtra(Intent.EXTRA_TEXT, Api.shareUrl(slug, secret))
                            .putExtra(Intent.EXTRA_SUBJECT, albumName)
                        ctx.startActivity(Intent.createChooser(send, null))
                    }
                    ActionRow(
                        Icons.Outlined.FolderZip,
                        if (zipStarting) "Starting download…" else "Download as a zip",
                        "Full-size originals, saved to Downloads",
                    ) {
                        if (zipStarting) return@ActionRow
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
                    Column(
                        Modifier.fillMaxWidth().background(aura.surfaceElevated).border(1.dp, aura.borderSubtle).padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        Text("Saving to your gallery", style = Type.serif(24), color = aura.textPrimary)
                        LinearProgressIndicator(
                            progress = { if (total == 0) 0f else (saved + failed).toFloat() / total },
                            modifier = Modifier.fillMaxWidth().height(3.dp),
                            color = aura.brand,
                            trackColor = aura.borderSubtle,
                        )
                        Text("${saved + failed} of $total", style = Type.sans(14), color = aura.textMuted)
                        SecondaryButton("Stop") { job?.cancel(); phase = Phase.Finished }
                    }
                }
                Phase.Finished -> {
                    Column(
                        Modifier.fillMaxWidth().background(aura.surfaceElevated).border(1.dp, aura.borderSubtle).padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(Icons.Outlined.CheckCircle, null, Modifier.size(28.dp), tint = aura.success)
                        Text(
                            if (failed == 0) "All $saved saved" else "$saved saved, $failed didn't",
                            style = Type.serif(24), color = aura.textPrimary,
                        )
                        Text("They're in your gallery app under the ${PhotoSaver.ALBUM} album.", style = Type.sans(14), color = aura.textMuted)
                        BrandButton("Done", onClick = onDismiss)
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionRow(icon: ImageVector, title: String, subtitle: String, prominent: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(aura.surfaceElevated)
            .border(1.dp, aura.borderSubtle)
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(40.dp).background(if (prominent) aura.brand else aura.brand.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, null, Modifier.size(18.dp), tint = if (prominent) aura.background else aura.brand) }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = Type.sans(16, FontWeight.Medium), color = aura.textPrimary)
            Text(subtitle, style = Type.sans(13), color = aura.textMuted)
        }
        Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = aura.textMuted)
    }
}
