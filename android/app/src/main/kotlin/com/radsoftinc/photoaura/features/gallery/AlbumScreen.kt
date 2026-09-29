package com.radsoftinc.photoaura.features.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.photoaura.core.AlbumDetail
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.FaceSummary
import com.radsoftinc.photoaura.core.Photo
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.ui.EmptyState
import com.radsoftinc.photoaura.ui.Eyebrow
import com.radsoftinc.photoaura.ui.RemoteImage
import com.radsoftinc.photoaura.ui.Type
import com.radsoftinc.photoaura.ui.aura
import kotlinx.coroutines.launch

data class AlbumState(
    val slug: String = "",
    val title: String = "",
    val detail: AlbumDetail? = null,
    val faces: List<FaceSummary> = emptyList(),
    val selectedFace: String? = null,
    val loading: Boolean = true,
    val error: String? = null,
) {
    val photos: List<Photo>?
        get() {
            val all = detail?.albumPhotos ?: return null
            val face = faces.firstOrNull { it.faceId == selectedFace } ?: return all
            val names = face.filenames.toSet()
            return all.filter { it.fileMetadata.filename in names }
        }
}

sealed interface AlbumIntent {
    data class Load(val slug: String, val title: String) : AlbumIntent
    data object Refresh : AlbumIntent
    data class SelectFace(val id: String) : AlbumIntent
    data class Loaded(val detail: AlbumDetail) : AlbumIntent
    data class FacesLoaded(val faces: List<FaceSummary>) : AlbumIntent
    data class Failed(val message: String) : AlbumIntent
}

class AlbumStore : Store<AlbumState, AlbumIntent>(AlbumState()) {
    override fun send(intent: AlbumIntent) {
        when (intent) {
            is AlbumIntent.Load -> {
                if (current.slug == intent.slug && current.detail != null) return
                setState { copy(slug = intent.slug, title = intent.title) }
                send(AlbumIntent.Refresh)
            }
            AlbumIntent.Refresh -> {
                val slug = current.slug
                setState { copy(loading = true, error = null) }
                io {
                    try { send(AlbumIntent.Loaded(Api.album(slug))) } catch (e: Exception) { send(AlbumIntent.Failed(e.friendly())) }
                }
                io { runCatching { send(AlbumIntent.FacesLoaded(Api.albumFaces(slug))) } }
            }
            is AlbumIntent.SelectFace -> setState { copy(selectedFace = if (selectedFace == intent.id) null else intent.id) }
            is AlbumIntent.Loaded -> setState { copy(detail = intent.detail, title = intent.detail.albumName, loading = false) }
            is AlbumIntent.FacesLoaded -> setState { copy(faces = intent.faces) }
            is AlbumIntent.Failed -> setState { copy(loading = false, error = intent.message) }
        }
    }
}

@Composable
fun AlbumScreen(
    slug: String,
    title: String,
    openActions: Boolean,
    viewer: ViewerHost,
    onBack: () -> Unit,
    store: AlbumStore = viewModel(key = "album-$slug"),
) {
    LaunchedEffect(slug) { store.send(AlbumIntent.Load(slug, title)) }
    val s by store.state.collectAsStateWithLifecycle()
    val grid = rememberLazyGridState()
    val frames = remember { TileFrames() }
    val scope = rememberCoroutineScope()
    var actions by remember { mutableStateOf(false) }
    LaunchedEffect(openActions, s.detail != null) { if (openActions && s.detail != null) actions = true }

    // header rows before the first tile: title, and faces when there are any
    val headerCount = if (s.faces.isNotEmpty()) 2 else 1

    Box(Modifier.fillMaxSize().background(aura.background)) {
    PhotoGrid(
        photos = if (s.error != null && s.detail == null) emptyList() else s.photos,
        frames = frames,
        state = grid,
        contentPadding = PaddingValues(top = TopBarHeight + WindowInsets.statusBars.asPaddingValues().calculateTopPadding(), bottom = 120.dp),
        onOpen = { i ->
            val photos = s.photos ?: return@PhotoGrid
            viewer.open(ViewerRequest(photos, i, frames, s.slug) { idx ->
                // keep the tile we're viewing on screen so closing flies into it
                scope.launch {
                    val target = headerCount + idx
                    val visible = grid.layoutInfo.visibleItemsInfo.any { it.index == target }
                    if (!visible) grid.scrollToItem(target)
                }
            })
        },
        header = {
            fullWidth("title") {
                Column(Modifier.padding(horizontal = 24.dp).padding(top = 8.dp, bottom = 20.dp)) {
                    Text(s.title, style = Type.serif(36), color = aura.textPrimary)
                    Spacer(Modifier.height(14.dp))
                    Eyebrow("Gallery")
                    Spacer(Modifier.height(8.dp))
                    val n = s.photos?.size
                    val face = s.faces.firstOrNull { it.faceId == s.selectedFace }
                    Text(
                        when {
                            n == null -> "Loading…"
                            face != null -> "Just ${face.name ?: "this person"} — $n ${if (n == 1) "photo" else "photos"}"
                            else -> "${s.detail?.imageCount ?: n} ${if (n == 1) "photo" else "photos"}"
                        },
                        style = Type.sans(15), color = aura.textSecondary,
                    )
                }
            }
            if (s.faces.isNotEmpty()) {
                fullWidth("faces") {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        modifier = Modifier.padding(bottom = 20.dp),
                    ) {
                        items(s.faces, key = { it.faceId }) { f ->
                            FaceChip(f, active = s.selectedFace == f.faceId) { store.send(AlbumIntent.SelectFace(f.faceId)) }
                        }
                    }
                }
            }
            if (s.error != null && s.detail == null) {
                fullWidth("error") {
                    Box(Modifier.padding(24.dp)) {
                        EmptyState(Icons.Outlined.Warning, "Couldn't load", s.error!!, "Try again") { store.send(AlbumIntent.Refresh) }
                    }
                }
            } else if (s.photos?.isEmpty() == true) {
                fullWidth("empty") {
                    Box(Modifier.padding(24.dp)) {
                        EmptyState(
                            Icons.Outlined.PhotoLibrary, "No photos",
                            if (s.selectedFace == null) "This gallery is empty." else "No photos of this person in the gallery.",
                        )
                    }
                }
            }
        },
    )

    ScreenTopBar(
        onBack = onBack,
        action = if (s.detail?.albumPhotos?.isNotEmpty() == true) {
            { actions = true }
        } else null,
        actionIcon = Icons.Outlined.Download,
        actionLabel = "Get your photos",
    )
    }

    if (actions) {
        val d = s.detail
        if (d != null) GalleryActionsSheet(d.albumName, d.slug, d.secret, d.albumPhotos) { actions = false }
    }
}

@Composable
private fun FaceChip(f: FaceSummary, active: Boolean, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(72.dp).clickable(onClick = onClick)) {
        RemoteImage(
            f.imageUrl,
            Modifier
                .size(72.dp)
                .background(aura.surfaceElevated)
                .border(if (active) 2.dp else 1.dp, if (active) aura.brand else aura.borderSubtle),
        )
        Spacer(Modifier.height(8.dp))
        Text(f.name ?: "${f.count}", style = Type.eyebrow(10), color = if (active) aura.brand else aura.textMuted, maxLines = 1)
    }
}
