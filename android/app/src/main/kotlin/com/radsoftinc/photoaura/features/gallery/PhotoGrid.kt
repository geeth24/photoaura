package com.radsoftinc.photoaura.features.gallery

import android.content.Context
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.radsoftinc.editorialstyle.EditorialSkeleton
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.photoaura.core.ImageUrls
import com.radsoftinc.photoaura.core.Photo
import com.radsoftinc.photoaura.ui.RemoteImage

/** Where each visible tile sits in the window, for the viewer's flight in and out. Plain map: writes mustn't recompose. */
class TileFrames {
    val rects = HashMap<String, Rect>()
}

/** Column count shared by every grid, like the web's saved density. 5 / 3 / 2, middle by default. */
object GridDensity {
    val steps = listOf(5, 3, 2)
    private var prefs: android.content.SharedPreferences? = null
    val step = mutableIntStateOf(1)

    fun init(context: Context) {
        prefs = context.getSharedPreferences("grid", Context.MODE_PRIVATE)
        step.intValue = prefs!!.getInt("density", 1).coerceIn(0, 2)
    }

    fun set(v: Int) {
        step.intValue = v.coerceIn(0, 2)
        prefs?.edit()?.putInt("density", step.intValue)?.apply()
    }

    val columns: Int get() = steps[step.intValue]
}

/**
 * Square edge-to-edge grid with a header above it. Two fingers pinch the density
 * (spread = bigger tiles); one finger scrolls and taps as usual.
 */
@Composable
fun PhotoGrid(
    photos: List<Photo>?,
    frames: TileFrames,
    state: LazyGridState,
    onOpen: (Int) -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
    gap: Dp = 2.dp,
    header: LazyGridScope.() -> Unit = {},
    footer: LazyGridScope.() -> Unit = {},
) {
    val haptics = LocalHapticFeedback.current
    val cols by GridDensity.step
    LazyVerticalGrid(
        columns = GridCells.Fixed(GridDensity.steps[cols]),
        state = state,
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                    var zoom = 1f
                    var pinched = false
                    do {
                        val e = awaitPointerEvent(PointerEventPass.Initial)
                        if (e.changes.count { it.pressed } >= 2) {
                            pinched = true
                            zoom *= e.calculateZoom()
                            e.changes.forEach { it.consume() }
                        } else if (pinched) {
                            // the finger left behind shouldn't tap or scroll
                            e.changes.forEach { it.consume() }
                        }
                    } while (e.changes.any { it.pressed })
                    if (pinched) {
                        val cur = GridDensity.step.intValue
                        val next = when {
                            zoom > 1.15f -> cur + 1
                            zoom < 0.87f -> cur - 1
                            else -> cur
                        }
                        if (next != cur && next in 0..2) {
                            GridDensity.set(next)
                            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        }
                    }
                }
            },
        contentPadding = contentPadding,
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(gap),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(gap),
    ) {
        header()
        if (photos == null) {
            items(15) { EditorialSkeleton(Modifier.fillMaxWidth().aspectRatio(1f)) }
        } else {
            itemsIndexed(photos, key = { _, p -> p.id }) { idx, p ->
                Tile(p, Modifier.onGloballyPositioned { frames.rects[p.id] = it.boundsInWindow() }) { onOpen(idx) }
            }
        }
        footer()
    }
}

/** Full-width row inside a PhotoGrid (titles, face strips, empty states). */
fun LazyGridScope.fullWidth(key: Any? = null, content: @Composable () -> Unit) {
    item(key = key, span = { GridItemSpan(maxLineSpan) }) { content() }
}

@Composable
private fun Tile(p: Photo, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .background(EditorialTheme.colors.surfaceElevated)
            .clickable(onClick = onClick),
    ) {
        RemoteImage(ImageUrls.tile(p), Modifier.fillMaxSize())
        if (p.isVideo) PlayBadge(Modifier.align(Alignment.Center))
    }
}

@Composable
fun PlayBadge(modifier: Modifier = Modifier, size: Dp = 34.dp) {
    Box(
        modifier.size(size).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Filled.PlayArrow, null, Modifier.padding(start = 2.dp).size(size * 0.5f), tint = Color.White)
    }
}
