package com.radsoftinc.photoaura.features.library

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.photoaura.core.AlbumSummary
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.ImageUrls
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.ui.EmptyState
import com.radsoftinc.photoaura.ui.RemoteImage
import com.radsoftinc.photoaura.ui.Skeleton
import com.radsoftinc.photoaura.ui.Type
import com.radsoftinc.photoaura.ui.aura

data class GalleriesState(val albums: List<AlbumSummary>? = null, val error: String? = null)

sealed interface GalleriesIntent {
    data object Load : GalleriesIntent
    data class Loaded(val a: List<AlbumSummary>) : GalleriesIntent
    data class Failed(val m: String) : GalleriesIntent
}

/** The studio's own view: every gallery it can see. Clients get Home instead. */
class GalleriesStore : Store<GalleriesState, GalleriesIntent>(GalleriesState()) {
    init { send(GalleriesIntent.Load) }

    override fun send(intent: GalleriesIntent) {
        when (intent) {
            GalleriesIntent.Load -> {
                val uid = Session.user?.id ?: return
                io { try { send(GalleriesIntent.Loaded(Api.myAlbums(uid))) } catch (e: Exception) { send(GalleriesIntent.Failed(e.friendly())) } }
            }
            is GalleriesIntent.Loaded -> setState { copy(albums = intent.a, error = null) }
            is GalleriesIntent.Failed -> setState { copy(error = intent.m) }
        }
    }
}

@Composable
fun GalleriesScreen(onOpenAlbum: (String, String) -> Unit, bottomPadding: Dp, store: GalleriesStore = viewModel()) {
    val s by store.state.collectAsStateWithLifecycle()
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(start = 24.dp, end = 24.dp, top = top + 24.dp, bottom = bottomPadding + 40.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize().background(aura.background),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Text("Galleries", style = Type.serif(40), color = aura.textPrimary, modifier = Modifier.padding(bottom = 12.dp))
        }
        val albums = s.albums
        when {
            albums == null && s.error != null -> item(span = { GridItemSpan(maxLineSpan) }) {
                EmptyState(Icons.Outlined.Warning, "Couldn't load", s.error!!, "Try again") { store.send(GalleriesIntent.Load) }
            }
            albums == null -> items(6) { Skeleton(Modifier.fillMaxWidth().aspectRatio(4f / 5f)) }
            albums.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                EmptyState(Icons.Outlined.PhotoLibrary, "No galleries", "Upload a shoot from the web dashboard and it shows up here.")
            }
            else -> items(albums, key = { it.albumId }) { a ->
                Box(
                    Modifier.fillMaxWidth().aspectRatio(4f / 5f).background(aura.surfaceCard).border(1.dp, aura.borderSubtle)
                        .clickable { onOpenAlbum(a.slug, a.albumName) },
                ) {
                    a.coverImage?.let { RemoteImage(ImageUrls.upright(it, ImageUrls.TILE), Modifier.fillMaxSize()) }
                    Box(
                        Modifier.fillMaxWidth().fillMaxHeight(0.55f).align(Alignment.BottomCenter)
                            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f)))),
                    )
                    Column(Modifier.align(Alignment.BottomStart).padding(14.dp)) {
                        Text(a.albumName, style = Type.serif(19), color = Color.White, maxLines = 2)
                        Text("${a.imageCount} PHOTOS", style = Type.eyebrow(9), color = Color.White.copy(alpha = 0.75f))
                    }
                }
            }
        }
    }
}
