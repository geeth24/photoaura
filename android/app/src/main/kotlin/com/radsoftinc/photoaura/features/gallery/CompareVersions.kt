package com.radsoftinc.photoaura.features.gallery

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.systemGestureExclusion
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radsoftinc.editorialstyle.EditorialColors
import com.radsoftinc.editorialstyle.EditorialPhotoBadge
import com.radsoftinc.editorialstyle.EditorialSegmentedControl
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.LocalEditorialColors
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.ImageUrls
import com.radsoftinc.photoaura.core.Photo
import com.radsoftinc.photoaura.core.PhotoVersion
import com.radsoftinc.photoaura.ui.RemoteImage
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.min
import kotlin.math.roundToInt

private val compareDay = DateTimeFormatter.ofPattern("MMM d, yyyy")

/**
 * Before/after of a revised photo: an earlier version laid exactly over the current one,
 * split by a divider the client drags. Always dark, like the viewer it opens from.
 */
@Composable
fun CompareVersions(photo: Photo, onClose: () -> Unit) {
    var versions by remember { mutableStateOf<List<PhotoVersion>?>(null) }
    var failed by remember { mutableStateOf(false) }
    var earlier by remember { mutableStateOf<PhotoVersion?>(null) }

    LaunchedEffect(photo.id) {
        val id = photo.fileMetadata.id ?: run { failed = true; return@LaunchedEffect }
        runCatching { Api.photoVersions(id).sortedBy { it.version } }
            .onSuccess { list ->
                versions = list
                earlier = list.getOrNull(list.size - 2)
                if (earlier == null) failed = true
            }
            .onFailure { failed = true }
    }
    BackHandler(onBack = onClose)

    CompositionLocalProvider(LocalEditorialColors provides EditorialColors.Dark) {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            val list = versions
            val before = earlier
            val after = list?.lastOrNull()
            when {
                before != null && after != null -> Split(before, after, photo)
                failed -> Text(
                    "Couldn't load the earlier version.",
                    Modifier.align(Alignment.Center),
                    style = EditorialTheme.typography.sans(15.sp),
                    color = Color.White.copy(alpha = 0.7f),
                )
                else -> CircularProgressIndicator(Modifier.align(Alignment.Center).size(24.dp), color = Color.White, strokeWidth = 2.dp)
            }

            Box(
                Modifier
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.6f), Color.Transparent)))
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .padding(bottom = 20.dp),
            ) {
                GlassCircle(Icons.Outlined.Close, "Close", Modifier.align(Alignment.CenterStart), onClose)
                Column(Modifier.align(Alignment.Center).width(220.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Compare versions", style = EditorialTheme.typography.sans(15.sp, FontWeight.SemiBold), color = Color.White, maxLines = 1)
                    after?.let { a ->
                        val sub = listOfNotNull(
                            a.revisionNumber?.let { "Revision $it" },
                            a.uploadedAt?.let { runCatching { LocalDateTime.parse(it).format(compareDay) }.getOrNull() },
                        ).joinToString(" · ")
                        if (sub.isNotEmpty()) Text(sub, style = EditorialTheme.typography.sans(11.sp), color = Color.White.copy(alpha = 0.6f), maxLines = 1)
                    }
                }
            }

            // only worth a picker once there's more than one earlier version
            val older = list?.dropLast(1).orEmpty()
            if (older.size >= 2 && before != null) {
                Box(
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.7f))))
                        .navigationBarsPadding()
                        .padding(top = 28.dp, bottom = 20.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    EditorialSegmentedControl(
                        older.map { (if (it.version == 1) "v1 · Original" else "v${it.version}") to it },
                        selection = before,
                        onSelect = { earlier = it },
                        modifier = Modifier.widthIn(max = 360.dp).padding(horizontal = 24.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun Split(before: PhotoVersion, after: PhotoVersion, current: Photo) {
    val density = LocalDensity.current
    val haptics = LocalHapticFeedback.current
    var split by remember { mutableFloatStateOf(0.5f) }

    fun moveTo(f: Float) {
        val next = f.coerceIn(0f, 1f)
        // a light tick when the divider passes the middle
        if ((split - 0.5f) * (next - 0.5f) < 0f || (next == 0.5f && split != 0.5f)) {
            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        }
        split = next
    }

    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        // one frame shaped like the current photo; both images fit inside it so the divider lines up
        val w = (after.width ?: current.fileMetadata.width).takeIf { it > 0 } ?: 3
        val h = (after.height ?: current.fileMetadata.height).takeIf { it > 0 } ?: 2
        val scale = min(maxWidth.value / w, maxHeight.value / h)
        val frameW = (w * scale).dp
        val frameH = (h * scale).dp
        val frameWpx = with(density) { frameW.toPx() }

        Box(
            Modifier
                .size(frameW, frameH)
                .systemGestureExclusion()
                .pointerInput(frameWpx) { detectTapGestures { moveTo(it.x / frameWpx) } }
                .pointerInput(frameWpx) {
                    detectHorizontalDragGestures { change, dx ->
                        change.consume()
                        moveTo(split + dx / frameWpx)
                    }
                }
                .semantics {
                    contentDescription = "Compare divider, v${before.version} on the left, v${after.version} on the right"
                    stateDescription = "${(split * 100).roundToInt()}% v${before.version}"
                    progressBarRangeInfo = ProgressBarRangeInfo(split, 0f..1f, steps = 0)
                    setProgress { v -> moveTo(v); true }
                },
        ) {
            RemoteImage(
                ImageUrls.upright(after.image, ImageUrls.FULL),
                Modifier.fillMaxSize(), ContentScale.Fit,
                placeholder = ImageUrls.upright(after.compressedImage, ImageUrls.TILE),
            )
            RemoteImage(
                ImageUrls.upright(before.image, ImageUrls.FULL),
                Modifier
                    .fillMaxSize()
                    .drawWithContent {
                        clipRect(right = size.width * split) {
                            // black behind it so a different shape never shows the new one through
                            drawRect(Color.Black)
                            this@drawWithContent.drawContent()
                        }
                    },
                ContentScale.Fit,
                placeholder = ImageUrls.upright(before.compressedImage, ImageUrls.TILE),
            )

            val x = with(density) { (frameWpx * split).toDp() }
            Box(Modifier.offset(x = x - 1.dp).width(2.dp).fillMaxHeight().background(Color.White))
            Box(
                Modifier
                    .align(Alignment.CenterStart)
                    .offset { IntOffset((frameWpx * split - 20.dp.toPx()).roundToInt(), 0) }
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color.White)
                    .border(1.dp, Color.Black.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Outlined.SwapHoriz, null, Modifier.size(20.dp), tint = Color.Black) }

            EditorialPhotoBadge("v${before.version}", Modifier.align(Alignment.BottomStart).padding(10.dp))
            EditorialPhotoBadge("v${after.version}", Modifier.align(Alignment.BottomEnd).padding(10.dp))
        }
    }
}
