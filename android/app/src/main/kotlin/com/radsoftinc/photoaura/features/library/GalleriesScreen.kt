package com.radsoftinc.photoaura.features.library

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.editorialstyle.EditorialEmptyState
import com.radsoftinc.editorialstyle.EditorialLargeTitle
import com.radsoftinc.editorialstyle.EditorialPhotoCard
import com.radsoftinc.editorialstyle.EditorialSkeleton
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.photoaura.core.AlbumSummary
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.ImageUrls
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.features.bookings.BookingSync
import com.radsoftinc.photoaura.ui.RemoteImage

data class GalleriesState(val albums: List<AlbumSummary>? = null, val error: String? = null)

sealed interface GalleriesIntent {
    data object Load : GalleriesIntent

    /** A booking change can unlock a proof gallery, so the tiles follow it. */
    data class Sync(val version: Int) : GalleriesIntent
    data class Loaded(val a: List<AlbumSummary>) : GalleriesIntent
    data class Failed(val m: String) : GalleriesIntent
}

/** The studio's own view: every gallery it can see. Clients get Home instead. */
class GalleriesStore : Store<GalleriesState, GalleriesIntent>(GalleriesState()) {
    private var synced = -1

    override fun send(intent: GalleriesIntent) {
        when (intent) {
            is GalleriesIntent.Sync -> if (intent.version != synced) {
                synced = intent.version
                send(GalleriesIntent.Load)
            }
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
    LaunchedEffect(BookingSync.version) { store.send(GalleriesIntent.Sync(BookingSync.version)) }
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val gutter = EditorialSpacing.screenGutter
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(start = gutter, end = gutter, top = top + EditorialSpacing.xLarge, bottom = bottomPadding + EditorialSpacing.xxxLarge),
        horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.small),
        verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small),
        modifier = Modifier.fillMaxSize().background(EditorialTheme.colors.background),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            EditorialLargeTitle("Galleries", Modifier.padding(bottom = EditorialSpacing.small))
        }
        val albums = s.albums
        when {
            albums == null && s.error != null -> item(span = { GridItemSpan(maxLineSpan) }) {
                EditorialEmptyState(
                    Icons.Outlined.Warning, "Couldn't load",
                    subtitle = s.error, actionTitle = "Try again", onAction = { store.send(GalleriesIntent.Load) },
                )
            }
            albums == null -> items(6) { EditorialSkeleton(Modifier.fillMaxWidth().aspectRatio(4f / 5f)) }
            albums.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                EditorialEmptyState(Icons.Outlined.PhotoLibrary, "No galleries", subtitle = "Upload a shoot from the web dashboard and it shows up here.")
            }
            else -> items(albums, key = { it.albumId }) { a ->
                EditorialPhotoCard(
                    a.albumName,
                    caption = (if (a.locked) "Preview · " else "") + "${a.imageCount} photos",
                    aspect = 4f / 5f,
                    onClick = { onOpenAlbum(a.slug, a.albumName) },
                ) {
                    Box(Modifier.fillMaxSize()) {
                        a.coverImage?.let { RemoteImage(ImageUrls.upright(it, ImageUrls.TILE), Modifier.fillMaxSize()) }
                        if (a.locked) {
                            Icon(
                                Icons.Outlined.Lock, "Proof preview",
                                Modifier.align(Alignment.TopEnd).padding(EditorialSpacing.small)
                                    .background(Color.Black.copy(alpha = 0.55f)).padding(5.dp).size(12.dp),
                                tint = Color.White,
                            )
                        }
                    }
                }
            }
        }
    }
}
