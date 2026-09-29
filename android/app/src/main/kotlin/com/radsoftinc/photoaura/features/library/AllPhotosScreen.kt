package com.radsoftinc.photoaura.features.library

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.Photo
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.features.gallery.PhotoGrid
import com.radsoftinc.photoaura.features.gallery.TileFrames
import com.radsoftinc.photoaura.features.gallery.ViewerHost
import com.radsoftinc.photoaura.features.gallery.ViewerRequest
import com.radsoftinc.photoaura.features.gallery.fullWidth
import com.radsoftinc.photoaura.ui.EmptyState
import com.radsoftinc.photoaura.ui.Eyebrow
import com.radsoftinc.photoaura.ui.Type
import com.radsoftinc.photoaura.ui.aura
import kotlinx.coroutines.launch

enum class Orientation(val label: String, val api: String?) { All("All", null), Portrait("Portrait", "portrait"), Landscape("Landscape", "landscape") }

data class AllPhotosState(
    val orientation: Orientation = Orientation.All,
    val photos: List<Photo>? = null,
    val error: String? = null,
)

sealed interface AllPhotosIntent {
    data object Load : AllPhotosIntent
    data class Orient(val o: Orientation) : AllPhotosIntent
    data class Loaded(val o: Orientation, val photos: List<Photo>) : AllPhotosIntent
    data class Failed(val m: String) : AllPhotosIntent
}

class AllPhotosStore : Store<AllPhotosState, AllPhotosIntent>(AllPhotosState()) {
    init { send(AllPhotosIntent.Load) }

    override fun send(intent: AllPhotosIntent) {
        when (intent) {
            AllPhotosIntent.Load -> {
                val uid = Session.user?.id ?: return
                val o = current.orientation
                setState { copy(error = null) }
                io {
                    try { send(AllPhotosIntent.Loaded(o, Api.allPhotos(uid, o.api))) } catch (e: Exception) { send(AllPhotosIntent.Failed(e.friendly())) }
                }
            }
            is AllPhotosIntent.Orient -> {
                if (intent.o == current.orientation) return
                setState { copy(orientation = intent.o, photos = null) }
                send(AllPhotosIntent.Load)
            }
            // a slow response for an older filter mustn't overwrite the current one
            is AllPhotosIntent.Loaded -> if (intent.o == current.orientation) setState { copy(photos = intent.photos) }
            is AllPhotosIntent.Failed -> setState { copy(error = intent.m, photos = photos ?: emptyList()) }
        }
    }
}

@Composable
fun AllPhotosScreen(viewer: ViewerHost, bottomPadding: Dp, store: AllPhotosStore = viewModel()) {
    val s by store.state.collectAsStateWithLifecycle()
    val grid = rememberLazyGridState()
    val frames = remember { TileFrames() }
    val scope = rememberCoroutineScope()
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val headerCount = 1

    Box(Modifier.fillMaxSize().background(aura.background)) {
        PhotoGrid(
            photos = s.photos,
            frames = frames,
            state = grid,
            contentPadding = PaddingValues(top = top + 24.dp, bottom = bottomPadding + 40.dp),
            onOpen = { i ->
                val photos = s.photos ?: return@PhotoGrid
                viewer.open(ViewerRequest(photos, i, frames, null) { idx ->
                    scope.launch {
                        val target = headerCount + idx
                        if (grid.layoutInfo.visibleItemsInfo.none { it.index == target }) grid.scrollToItem(target)
                    }
                })
            },
            header = {
                fullWidth("head") {
                    Column(Modifier.padding(horizontal = 24.dp).padding(bottom = 20.dp)) {
                        Text("Your photos", style = Type.serif(40), color = aura.textPrimary)
                        Spacer(Modifier.height(14.dp))
                        Eyebrow("Library")
                        Spacer(Modifier.height(8.dp))
                        val n = s.photos?.size
                        Text(if (n == null) "Loading…" else "$n ${if (n == 1) "photo" else "photos"}", style = Type.sans(15), color = aura.textSecondary)
                        Spacer(Modifier.height(18.dp))
                        Row(Modifier.fillMaxWidth().border(1.dp, aura.borderDefault)) {
                            Orientation.entries.forEach { o ->
                                val on = o == s.orientation
                                Box(
                                    Modifier
                                        .weight(1f)
                                        .background(if (on) aura.brand.copy(alpha = 0.14f) else aura.background)
                                        .clickable { store.send(AllPhotosIntent.Orient(o)) }
                                        .padding(vertical = 14.dp),
                                    contentAlignment = Alignment.Center,
                                ) { Text(o.label.uppercase(), style = Type.eyebrow(11), color = if (on) aura.brand else aura.textMuted) }
                            }
                        }
                    }
                }
                if (s.error != null && s.photos.isNullOrEmpty()) {
                    fullWidth("error") {
                        Box(Modifier.padding(24.dp)) { EmptyState(Icons.Outlined.Warning, "Couldn't load", s.error!!, "Try again") { store.send(AllPhotosIntent.Load) } }
                    }
                } else if (s.photos?.isEmpty() == true) {
                    fullWidth("empty") {
                        Box(Modifier.padding(24.dp)) {
                            EmptyState(Icons.Outlined.PhotoLibrary, "No photos", "Try a different orientation, or wait for your photographer to share a gallery.")
                        }
                    }
                }
            },
        )
    }
}
