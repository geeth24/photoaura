package com.radsoftinc.photoaura.features.gallery

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Photo
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.lerp
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.radsoftinc.editorialstyle.EditorialColors
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.ImageUrls
import com.radsoftinc.photoaura.core.Photo
import com.radsoftinc.photoaura.core.PhotoSaver
import com.radsoftinc.photoaura.core.PhotoVersion
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.ui.RemoteImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL
import java.time.format.DateTimeFormatter
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** What the root layer needs to show one viewer over the screen that opened it. */
class ViewerRequest(
    val photos: List<Photo>,
    val start: Int,
    val frames: TileFrames,
    val albumSlug: String?,
    /** the grid keeps the current photo's tile on screen for the flight back */
    val onIndex: (Int) -> Unit = {},
)

/** Holds the open viewer; lives at the app root so the flight shares the grid's window coordinates. */
class ViewerHost {
    var request by mutableStateOf<ViewerRequest?>(null)
        private set

    fun open(r: ViewerRequest) {
        request = r
    }

    fun close() {
        request = null
    }
}

private val Flight = CubicBezierEasing(0.32f, 0.72f, 0f, 1f)
private const val FLIGHT_MS = 380

@kotlin.OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PhotoViewer(req: ViewerRequest, onClosed: () -> Unit) {
    val photos = req.photos
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current
    val density = LocalDensity.current
    val haptics = LocalHapticFeedback.current

    val pager = rememberPagerState(initialPage = req.start) { photos.size }
    var index by remember { mutableStateOf(req.start) }
    var chrome by remember { mutableStateOf(true) }
    var zoomed by remember { mutableStateOf(false) }
    var info by remember { mutableStateOf(false) }
    var versionsOf by remember { mutableStateOf<Photo?>(null) }

    // flight state: the hero image is framed by `hero` while it flies; null once the pager takes over
    val progress = remember { Animatable(0f) }
    var from by remember { mutableStateOf<Rect?>(req.frames.rects[photos[req.start].id]) }
    var to by remember { mutableStateOf<Rect?>(null) }
    var flying by remember { mutableStateOf(from != null) }
    var heroFade by remember { mutableFloatStateOf(1f) }
    var backdrop by remember { mutableFloatStateOf(if (from != null) 0f else 1f) }
    var closing by remember { mutableStateOf(false) }

    // pull-down drag
    var drag by remember { mutableStateOf(Offset.Zero) }

    var favorites by remember { mutableStateOf(emptySet<String>()) }
    LaunchedEffect(req.albumSlug) {
        req.albumSlug?.let { slug -> runCatching { favorites = Api.favorites(slug).toSet() } }
    }

    LaunchedEffect(pager) {
        snapshotFlow { pager.currentPage }.distinctUntilChanged().collect {
            index = it
            zoomed = false
            req.onIndex(it)
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val w = with(density) { maxWidth.toPx() }
        val h = with(density) { maxHeight.toPx() }

        fun fitRect(p: Photo): Rect {
            val m = p.fileMetadata
            if (m.width <= 0 || m.height <= 0) return Rect(0f, 0f, w, h)
            val s = min(w / m.width, h / m.height)
            val fw = m.width * s
            val fh = m.height * s
            return Rect((w - fw) / 2, (h - fh) / 2, (w + fw) / 2, (h + fh) / 2)
        }

        val dragProgress = min(1f, max(0f, drag.y) / with(density) { 260.dp.toPx() })
        val dragScale = 1f - dragProgress * 0.35f

        LaunchedEffect(Unit) {
            val start = from ?: return@LaunchedEffect
            to = fitRect(photos[req.start])
            progress.snapTo(0f)
            progress.animateTo(1f, tween(FLIGHT_MS, easing = Flight)) { backdrop = value }
            from = null; to = null; flying = false
        }

        fun close() {
            if (closing) return
            closing = true
            chrome = false
            val p = photos[index]
            val fit = fitRect(p)
            val cx = w / 2; val cy = h / 2
            // the photo as drawn right now, drag and shrink included
            val now = Rect(
                cx + (fit.left - cx) * dragScale + drag.x,
                cy + (fit.top - cy) * dragScale + drag.y,
                cx + (fit.right - cx) * dragScale + drag.x,
                cy + (fit.bottom - cy) * dragScale + drag.y,
            )
            val startBackdrop = backdrop * (1 - dragProgress * 0.9f)
            drag = Offset.Zero
            val target = req.frames.rects[p.id]
            from = now
            to = target ?: Rect(now.left + now.width * 0.2f, now.top + now.height * 0.2f, now.right - now.width * 0.2f, now.bottom - now.height * 0.2f)
            flying = true
            scope.launch {
                progress.snapTo(0f)
                progress.animateTo(1f, tween(FLIGHT_MS, easing = Flight)) {
                    backdrop = startBackdrop * (1 - value)
                    if (target == null) heroFade = 1 - value
                }
                onClosed()
            }
        }

        BackHandler { if (info) info = false else close() }

        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = backdrop * (1 - dragProgress * 0.9f))))

        HorizontalPager(
            state = pager,
            beyondViewportPageCount = 1,
            userScrollEnabled = !zoomed && drag == Offset.Zero,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    alpha = if (flying) 0f else 1f
                    scaleX = dragScale; scaleY = dragScale
                    translationX = drag.x; translationY = drag.y
                }
                .pointerInput(zoomed, closing) {
                    if (zoomed || closing) return@pointerInput
                    detectVerticalDragGestures(
                        onDragEnd = {
                            if (drag.y > with(density) { 110.dp.toPx() }) close()
                            else scope.launch {
                                val a = Animatable(drag, Offset.VectorConverter)
                                a.animateTo(Offset.Zero, tween(260)) { drag = value }
                            }
                        },
                        onDragCancel = { drag = Offset.Zero },
                    ) { change, amount ->
                        change.consume()
                        if (chrome) chrome = false
                        drag = Offset(drag.x, max(-40f, drag.y + amount))
                    }
                },
        ) { page ->
            val p = photos[page]
            if (p.isVideo) {
                VideoPage(p, playing = page == index)
            } else {
                ZoomablePhoto(
                    p,
                    onZoomed = { if (page == index) zoomed = it },
                    onTap = { chrome = !chrome },
                )
            }
        }

        // the flying image
        val a = from; val b = to
        if (flying && a != null && b != null) {
            val r = lerp(a, b, progress.value)
            RemoteImage(
                ImageUrls.tile(photos[index]),
                Modifier
                    .offset { IntOffset(r.left.roundToInt(), r.top.roundToInt()) }
                    .size(with(density) { r.width.toDp() }, with(density) { r.height.toDp() })
                    .graphicsLayer { alpha = heroFade },
                crossfade = false,
            )
        }

        AnimatedVisibility(chrome && !flying && drag == Offset.Zero, enter = fadeIn(), exit = fadeOut()) {
            Box(Modifier.fillMaxSize()) {
                TopBar(
                    photo = photos[index],
                    index = index,
                    total = photos.size,
                    favorite = photos[index].fileMetadata.filename in favorites,
                    canFavorite = req.albumSlug != null && !photos[index].isVideo,
                    onClose = { close() },
                    onInfo = { info = true },
                    onVersions = { versionsOf = photos[index] },
                    onFavorite = {
                        val slug = req.albumSlug ?: return@TopBar
                        val name = photos[index].fileMetadata.filename
                        val want = name !in favorites
                        favorites = if (want) favorites + name else favorites - name
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        scope.launch {
                            runCatching { Api.setFavorite(slug, name, want) }
                                .onFailure { favorites = if (want) favorites - name else favorites + name }
                        }
                    },
                    modifier = Modifier.align(Alignment.TopCenter),
                )
                Scrubber(
                    photos = photos,
                    index = index,
                    onPick = { i -> scope.launch { pager.scrollToPage(i) } },
                    onHaptic = { haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove) },
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }
        }
    }

    versionsOf?.let { p -> VersionsOverlay(p) { versionsOf = null } }

    if (info) {
        ModalBottomSheet(onDismissRequest = { info = false }, containerColor = EditorialColors.Dark.surfaceElevated) {
            InfoSheet(photos[index])
        }
    }
}

// MARK: - pages

@Composable
private fun ZoomablePhoto(p: Photo, onZoomed: (Boolean) -> Unit, onTap: () -> Unit) {
    var scale by remember { mutableFloatStateOf(1f) }
    var pan by remember { mutableStateOf(Offset.Zero) }
    val scope = rememberCoroutineScope()

    fun set(s: Float, o: Offset) {
        val was = scale > 1.01f
        scale = s; pan = o
        val now = scale > 1.01f
        if (was != now) onZoomed(now)
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val w = constraints.maxWidth.toFloat()
        val h = constraints.maxHeight.toFloat()
        fun clamp(s: Float, o: Offset) = Offset(
            o.x.coerceIn(-(w * (s - 1) / 2), w * (s - 1) / 2),
            o.y.coerceIn(-(h * (s - 1) / 2), h * (s - 1) / 2),
        )
        Box(
            Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures(
                        onTap = { onTap() },
                        onDoubleTap = { at ->
                            scope.launch {
                                if (scale > 1.01f) set(1f, Offset.Zero)
                                else {
                                    val s = 3f
                                    // zoom toward the tapped point, not the middle
                                    val o = Offset((w / 2 - at.x) * (s - 1), (h / 2 - at.y) * (s - 1))
                                    set(s, clamp(s, o))
                                }
                            }
                        },
                    )
                }
                .pointerInput(Unit) {
                    awaitEachGesture {
                        awaitFirstDown(requireUnconsumed = false)
                        do {
                            val e = awaitPointerEvent()
                            val multi = e.changes.count { it.pressed } >= 2
                            if (multi || scale > 1.01f) {
                                val z = e.calculateZoom()
                                val c = e.calculateCentroid()
                                val newScale = (scale * z).coerceIn(1f, 6f)
                                // keep the pinch centre fixed under the fingers
                                val focus = c - Offset(w / 2, h / 2)
                                val o = (pan - focus) * (newScale / scale) + focus + e.calculatePan()
                                set(newScale, clamp(newScale, o))
                                e.changes.forEach { it.consume() }
                            }
                        } while (e.changes.any { it.pressed })
                        if (scale < 1.01f) set(1f, Offset.Zero)
                    }
                }
                .graphicsLayer {
                    scaleX = scale; scaleY = scale
                    translationX = pan.x; translationY = pan.y
                },
        ) {
            // the grid already cached this size, so the first frame is never empty
            RemoteImage(ImageUrls.tile(p), Modifier.fillMaxSize(), ContentScale.Fit, crossfade = false)
            RemoteImage(ImageUrls.full(p), Modifier.fillMaxSize(), ContentScale.Fit)
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun VideoPage(p: Photo, playing: Boolean) {
    val ctx = LocalContext.current
    val player = remember(p.id) { ExoPlayer.Builder(ctx).build().apply { setMediaItem(MediaItem.fromUri(p.image)); prepare() } }
    LaunchedEffect(playing) { player.playWhenReady = playing }
    androidx.compose.runtime.DisposableEffect(player) { onDispose { player.release() } }
    AndroidView(
        factory = { PlayerView(it).apply { this.player = player; setShowNextButton(false); setShowPreviousButton(false) } },
        modifier = Modifier.fillMaxSize().navigationBarsPadding().padding(bottom = 90.dp),
    )
}

// MARK: - chrome

private val dayFmt = DateTimeFormatter.ofPattern("MMMM d, yyyy")
private val timeFmt = DateTimeFormatter.ofPattern("h:mm a")

@Composable
private fun TopBar(
    photo: Photo,
    index: Int,
    total: Int,
    favorite: Boolean,
    canFavorite: Boolean,
    onClose: () -> Unit,
    onInfo: () -> Unit,
    onVersions: () -> Unit,
    onFavorite: () -> Unit,
    modifier: Modifier,
) {
    val count = "${index + 1} of $total"
    val taken = photo.fileMetadata.takenAt
    Box(
        modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.6f), Color.Transparent)))
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .padding(bottom = 20.dp),
    ) {
        GlassCircle(Icons.Outlined.Close, "Close", Modifier.align(Alignment.CenterStart), onClose)
        Column(Modifier.align(Alignment.Center).width(170.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(taken?.format(dayFmt) ?: count, style = EditorialTheme.typography.sans(15.sp, androidx.compose.ui.text.font.FontWeight.SemiBold), color = Color.White, maxLines = 1)
            if (taken != null) {
                Text("${taken.format(timeFmt)} · $count", style = EditorialTheme.typography.sans(11.sp), color = Color.White.copy(alpha = 0.6f), maxLines = 1)
            }
            val v = photo.fileMetadata.version
            if (v > 1 && photo.fileMetadata.id != null) {
                Text(
                    "v$v · Earlier versions",
                    Modifier.padding(top = 6.dp).clip(RoundedCornerShape(50)).background(Color.White.copy(alpha = 0.16f))
                        .clickable(onClick = onVersions).padding(horizontal = 10.dp, vertical = 3.dp),
                    style = EditorialTheme.typography.sans(11.sp, androidx.compose.ui.text.font.FontWeight.Medium),
                    color = Color.White,
                    maxLines = 1,
                )
            }
        }
        Row(
            Modifier.align(Alignment.CenterEnd).clip(RoundedCornerShape(50)).background(Color.White.copy(alpha = 0.16f)).padding(horizontal = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (canFavorite) {
                PillIcon(if (favorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, if (favorite) "Remove from picks" else "Add to picks",
                    tint = if (favorite) Color(0xFF00A6FB) else Color.White, onClick = onFavorite)
            }
            PillIcon(Icons.Outlined.Info, "Info", onClick = onInfo)
            DownloadMenu(photo)
        }
    }
}

@Composable
private fun DownloadMenu(photo: Photo) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var open by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    var pending by remember { mutableStateOf<Boolean?>(null) }

    fun save(optimized: Boolean) {
        busy = true
        scope.launch {
            val url = if (optimized) ImageUrls.optimized(photo.image) else PhotoSaver.originalUrl(photo)
            val r = runCatching { PhotoSaver.save(ctx, url, photo.fileMetadata.filename, photo.fileMetadata.contentType) }
            busy = false
            if (r.isSuccess) {
                done = true
                android.widget.Toast.makeText(ctx, "Saved to your gallery", android.widget.Toast.LENGTH_SHORT).show()
                delay(1500); done = false
            } else {
                android.widget.Toast.makeText(ctx, r.exceptionOrNull()!!.friendly(), android.widget.Toast.LENGTH_LONG).show()
            }
        }
    }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        val opt = pending; pending = null
        if (ok && opt != null) save(opt)
    }

    fun saveChecked(optimized: Boolean) {
        open = false
        if (PhotoSaver.needsLegacyPermission &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            pending = optimized
            permission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        } else save(optimized)
    }

    fun share() {
        open = false
        busy = true
        scope.launch {
            // share the actual file so it lands full-size, not a link they may not open
            val r = runCatching {
                withContext(Dispatchers.IO) {
                    val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
                    val f = File(dir, photo.fileMetadata.filename)
                    URL(PhotoSaver.originalUrl(photo)).openStream().use { i -> f.outputStream().use { i.copyTo(it) } }
                    FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", f)
                }
            }
            busy = false
            r.onSuccess { uri: Uri ->
                val send = Intent(Intent.ACTION_SEND)
                    .setType(photo.fileMetadata.contentType ?: "image/jpeg")
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                ctx.startActivity(Intent.createChooser(send, null))
            }.onFailure {
                android.widget.Toast.makeText(ctx, it.friendly(), android.widget.Toast.LENGTH_LONG).show()
            }
        }
    }

    Box {
        PillIcon(
            when { busy -> Icons.Outlined.Sync; done -> Icons.Outlined.Check; else -> Icons.Outlined.Download },
            "Save or share", enabled = !busy,
        ) { open = true }
        DropdownMenu(open, { open = false }) {
            DropdownMenuItem({ Text("Save original") }, { saveChecked(false) }, leadingIcon = { Icon(Icons.Outlined.Photo, null) })
            if (!photo.isVideo) {
                DropdownMenuItem({ Text("Save optimized") }, { saveChecked(true) }, leadingIcon = { Icon(Icons.Outlined.Download, null) })
            }
            DropdownMenuItem({ Text("Share…") }, { share() }, leadingIcon = { Icon(Icons.AutoMirrored.Outlined.Send, null) })
        }
    }
}

@Composable
private fun GlassCircle(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier.size(40.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.16f)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, label, Modifier.size(20.dp), tint = Color.White) }
}

@Composable
private fun PillIcon(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    tint: Color = Color.White,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Box(
        Modifier.size(40.dp).clip(CircleShape).clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, label, Modifier.size(20.dp), tint = tint) }
}

/**
 * The web gallery's scrubber: the current photo at its real shape, the rest as
 * slivers. Dragging the strip changes the photo under the centre line.
 */
@Composable
private fun Scrubber(photos: List<Photo>, index: Int, onPick: (Int) -> Unit, onHaptic: () -> Unit, modifier: Modifier) {
    val list = rememberLazyListState(initialFirstVisibleItemIndex = index)
    val dragged by list.interactionSource.collectIsDraggedAsState()
    var userDriven by remember { mutableStateOf(false) }
    val density = LocalDensity.current
    val stripH = 46.dp
    val sliver = 22.dp

    fun widthOf(i: Int): androidx.compose.ui.unit.Dp {
        if (i != index) return sliver
        val m = photos[i].fileMetadata
        val aspect = if (m.height > 0) m.width.toFloat() / m.height else 1f
        return (stripH * aspect).coerceIn(sliver, stripH * 1.6f)
    }

    LaunchedEffect(dragged) {
        if (dragged) userDriven = true
    }
    // while the finger (or the fling after it) moves the strip, the photo follows
    LaunchedEffect(list) {
        snapshotFlow { list.isScrollInProgress to list.layoutInfo }.collect { (moving, info) ->
            if (!userDriven) return@collect
            if (!moving) {
                userDriven = false
                centre(list, index, density)
                return@collect
            }
            val mid = (info.viewportStartOffset + info.viewportEndOffset) / 2
            val hit = info.visibleItemsInfo.minByOrNull { abs(it.offset + it.size / 2 - mid) } ?: return@collect
            if (hit.index != index) {
                onPick(hit.index)
                onHaptic()
            }
        }
    }
    // the pager moved on its own (swipe), bring the strip along
    LaunchedEffect(index) {
        if (!userDriven) centre(list, index, density, animate = true)
    }

    BoxWithConstraints(
        modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.7f))))
            .navigationBarsPadding()
            .padding(top = 28.dp, bottom = 12.dp),
    ) {
        val half = maxWidth / 2
        LazyRow(
            state = list,
            contentPadding = PaddingValues(horizontal = half),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            modifier = Modifier.fillMaxWidth().height(stripH),
        ) {
            itemsIndexed(photos, key = { _, p -> p.id }) { i, p ->
                Box(
                    Modifier
                        .width(widthOf(i))
                        .height(stripH)
                        .background(Color.White.copy(alpha = 0.08f))
                        .graphicsLayer { alpha = if (i == index) 1f else 0.75f }
                        .clickable { onPick(i) },
                ) {
                    RemoteImage(ImageUrls.tile(p), Modifier.fillMaxSize(), crossfade = false)
                    if (p.isVideo && i == index) PlayBadge(Modifier.align(Alignment.Center), 18.dp)
                }
            }
        }
    }
}

private suspend fun centre(list: androidx.compose.foundation.lazy.LazyListState, i: Int, density: androidx.compose.ui.unit.Density, animate: Boolean = false) {
    // bring it on screen first, then measure: its real width is only known once laid out
    if (list.layoutInfo.visibleItemsInfo.none { it.index == i }) list.scrollToItem(i)
    val info = list.layoutInfo
    val item = info.visibleItemsInfo.firstOrNull { it.index == i } ?: return
    val mid = (info.viewportStartOffset + info.viewportEndOffset) / 2f
    val delta = item.offset + item.size / 2f - mid
    if (abs(delta) < 1f) return
    if (animate) list.animateScrollBy(delta) else list.scrollBy(delta)
}

// MARK: - info

@Composable
private fun InfoSheet(p: Photo) {
    val m = p.fileMetadata
    val e = m.exif
    fun s(k: String) = (e?.get(k) as? kotlinx.serialization.json.JsonPrimitive)?.content?.takeIf { it.isNotBlank() }
    val rows = buildList {
        add("File" to m.filename)
        if (m.version > 1) add("Version" to "v${m.version}" + (m.revisionNumber?.let { " · Revision $it" } ?: ""))
        if (m.width > 0) add("Size" to "${m.width} × ${m.height}")
        m.size?.takeIf { it > 0 }?.let { add("File size" to String.format("%.1f MB", it / 1_048_576.0)) }
        val make = s("Make").orEmpty(); val model = s("Model").orEmpty()
        val camera = if (model.startsWith(make)) model else listOf(make, model).filter { it.isNotEmpty() }.joinToString(" ")
        if (camera.isNotEmpty()) add("Camera" to camera)
        s("LensModel")?.let { add("Lens" to it) }
        m.takenAt?.let { add("Taken" to it.format(DateTimeFormatter.ofPattern("MMM d, yyyy 'at' h:mm a"))) }
    }
    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Photo info", style = EditorialTheme.typography.serif(26.sp), color = Color.White)
        rows.forEach { (k, v) ->
            Row(Modifier.fillMaxWidth()) {
                Text(k.uppercase(), style = EditorialTheme.typography.label(10.sp, 3.sp), color = Color.White.copy(alpha = 0.6f), modifier = Modifier.width(110.dp).padding(top = 3.dp))
                Text(v, style = EditorialTheme.typography.sans(15.sp), color = Color.White, overflow = TextOverflow.Ellipsis)
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

// MARK: - versions

private val versionDay = DateTimeFormatter.ofPattern("MMM d, yyyy")

/**
 * Every stored edit of one photo, over the viewer. Opens on the version before the
 * current one so a tap on the strip flips between old and new.
 */
@Composable
private fun VersionsOverlay(photo: Photo, onClose: () -> Unit) {
    var versions by remember { mutableStateOf<List<PhotoVersion>?>(null) }
    var failed by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<PhotoVersion?>(null) }
    val current = photo.fileMetadata.version

    LaunchedEffect(photo.id) {
        val id = photo.fileMetadata.id ?: return@LaunchedEffect
        runCatching { Api.photoVersions(id) }
            .onSuccess { list ->
                versions = list
                selected = list.lastOrNull { it.version < current } ?: list.lastOrNull()
            }
            .onFailure { failed = true }
    }
    BackHandler(onBack = onClose)

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        val v = selected
        if (v != null) {
            androidx.compose.runtime.key(v.version) { ZoomablePhoto(v.photo, onZoomed = {}, onTap = {}) }
        } else if (failed) {
            Text(
                "Couldn't load earlier versions.",
                Modifier.align(Alignment.Center),
                style = EditorialTheme.typography.sans(15.sp),
                color = Color.White.copy(alpha = 0.7f),
            )
        } else {
            androidx.compose.material3.CircularProgressIndicator(
                Modifier.align(Alignment.Center).size(24.dp), color = Color.White, strokeWidth = 2.dp,
            )
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
            if (v != null) {
                Column(Modifier.align(Alignment.Center).width(200.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    val title = when {
                        v.version == current -> "Current version"
                        v.version == 1 -> "Original"
                        else -> "Version ${v.version}"
                    }
                    Text(title, style = EditorialTheme.typography.sans(15.sp, androidx.compose.ui.text.font.FontWeight.SemiBold), color = Color.White, maxLines = 1)
                    val sub = listOfNotNull(
                        v.revisionNumber?.let { "Revision $it" } ?: "First delivery".takeIf { v.version == 1 },
                        v.uploadedAt?.let { runCatching { java.time.LocalDateTime.parse(it).format(versionDay) }.getOrNull() },
                    ).joinToString(" · ")
                    if (sub.isNotEmpty()) {
                        Text(sub, style = EditorialTheme.typography.sans(11.sp), color = Color.White.copy(alpha = 0.6f), maxLines = 1)
                    }
                }
            }
        }

        val list = versions
        if (list != null && list.size > 1) {
            Row(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.7f))))
                    .navigationBarsPadding()
                    .padding(top = 28.dp, bottom = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            ) {
                list.forEach { pv ->
                    val on = pv.version == v?.version
                    Text(
                        if (pv.version == current) "v${pv.version} · now" else "v${pv.version}",
                        Modifier.clip(RoundedCornerShape(50))
                            .background(if (on) Color.White else Color.White.copy(alpha = 0.16f))
                            .clickable { selected = pv }
                            .padding(horizontal = 14.dp, vertical = 7.dp),
                        style = EditorialTheme.typography.sans(13.sp, androidx.compose.ui.text.font.FontWeight.Medium),
                        color = if (on) Color.Black else Color.White,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}
