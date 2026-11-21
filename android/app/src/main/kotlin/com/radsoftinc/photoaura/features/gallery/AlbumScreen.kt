package com.radsoftinc.photoaura.features.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
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
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.editorialstyle.EditorialChip
import com.radsoftinc.editorialstyle.EditorialChipRow
import com.radsoftinc.editorialstyle.EditorialEmptyState
import com.radsoftinc.editorialstyle.EditorialEyebrow
import com.radsoftinc.editorialstyle.EditorialFaceChip
import com.radsoftinc.editorialstyle.EditorialSectionHeader
import com.radsoftinc.editorialstyle.EditorialSegmentedControl
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTopBar
import com.radsoftinc.editorialstyle.EditorialTopBarHeight
import com.radsoftinc.photoaura.core.AlbumDetail
import com.radsoftinc.photoaura.core.AlbumRevision
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.FaceSummary
import com.radsoftinc.photoaura.core.GalleryView
import com.radsoftinc.photoaura.core.MomentSection
import com.radsoftinc.photoaura.core.Photo
import com.radsoftinc.photoaura.core.SeenRevisions
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.availableViews
import com.radsoftinc.photoaura.core.defaultView
import com.radsoftinc.photoaura.core.filterHighlights
import com.radsoftinc.photoaura.core.formatMomentRange
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.core.momentHeaderOffsets
import com.radsoftinc.photoaura.core.momentSections
import com.radsoftinc.photoaura.core.momentTileOffset
import com.radsoftinc.photoaura.core.momentTitle
import com.radsoftinc.photoaura.ui.RemoteImage
import kotlinx.coroutines.launch

data class AlbumState(
    val slug: String = "",
    val title: String = "",
    val detail: AlbumDetail? = null,
    val faces: List<FaceSummary> = emptyList(),
    val selectedFace: String? = null,
    val revisionOnly: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
) {
    val revision: AlbumRevision? get() = detail?.revision

    /** Photos after the revision and face filters, before any view is applied. */
    private val base: List<Photo>?
        get() {
            var all = detail?.albumPhotos ?: return null
            val rev = revision
            if (revisionOnly && rev != null) all = all.filter { it.fileMetadata.revisionNumber == rev.number }
            val face = faces.firstOrNull { it.faceId == selectedFace } ?: return all
            val names = face.filenames.toSet()
            return all.filter { it.fileMetadata.filename in names }
        }

    fun sections(): List<MomentSection> = momentSections(base ?: emptyList(), detail?.moments)

    /** What the grid and viewer show for `view`; moments come out flattened in section order. */
    fun photos(view: GalleryView): List<Photo>? {
        val all = base ?: return null
        return when (view) {
            GalleryView.All -> all
            GalleryView.Highlights -> filterHighlights(all, detail?.highlights)
            GalleryView.Moments -> sections().flatMap { it.photos }
        }
    }
}

sealed interface AlbumIntent {
    data class Load(val slug: String, val title: String) : AlbumIntent
    data object Refresh : AlbumIntent
    data class SelectFace(val id: String) : AlbumIntent
    data class RevisionOnly(val on: Boolean) : AlbumIntent
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
            is AlbumIntent.RevisionOnly -> setState { copy(revisionOnly = intent.on) }
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
    onOpenBooking: (String) -> Unit,
    store: AlbumStore = viewModel(key = "album-$slug"),
) {
    LaunchedEffect(slug) { store.send(AlbumIntent.Load(slug, title)) }
    val s by store.state.collectAsStateWithLifecycle()
    val grid = rememberLazyGridState()
    val frames = remember { TileFrames() }
    val scope = rememberCoroutineScope()
    var actions by remember { mutableStateOf(false) }
    val locked = s.detail?.locked == true
    // a proof gallery has nothing to save; the server would refuse it anyway
    LaunchedEffect(openActions, s.detail != null) { if (openActions && s.detail != null && !locked) actions = true }
    LaunchedEffect(s.revision?.number) { SeenRevisions.markSeen(slug, s.revision) }

    val views = remember(s.detail) { s.detail?.availableViews() ?: listOf(GalleryView.All) }
    var chosen by rememberSaveable(slug) { mutableStateOf<GalleryView?>(null) }
    val view = chosen?.takeIf { it in views } ?: views.defaultView()
    val showViews = views.size > 1
    val photos = s.photos(view)
    val sections = if (view == GalleryView.Moments) s.sections() else null

    // header rows before the first tile: title, the view chips, the revision banner and faces when there are any
    val headerCount = 1 + (if (showViews) 1 else 0) + (if (locked) 1 else 0) + (if (s.revision != null) 1 else 0) + (if (s.faces.isNotEmpty()) 1 else 0)
    val topInset = EditorialTopBarHeight + WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    // the grid has no sticky headers, so the section whose header scrolled off is pinned over it
    val pinned by remember(sections, headerCount) {
        derivedStateOf {
            val secs = sections ?: return@derivedStateOf null
            val visible = grid.layoutInfo.visibleItemsInfo
            val at = momentHeaderOffsets(secs).map { it + headerCount }
            at.indices.lastOrNull { i ->
                val v = visible.firstOrNull { it.index == at[i] }
                if (v != null) v.offset.y <= 0 else at[i] < grid.firstVisibleItemIndex
            }?.let { secs[it] }
        }
    }

    Box(Modifier.fillMaxSize().background(EditorialTheme.colors.background)) {
    PhotoGrid(
        photos = if (s.error != null && s.detail == null) emptyList() else photos,
        frames = frames,
        state = grid,
        contentPadding = PaddingValues(top = topInset, bottom = 120.dp),
        sections = sections,
        sectionHeader = { MomentHeader(it) },
        onOpen = { i ->
            val shown = photos ?: return@PhotoGrid
            viewer.open(ViewerRequest(shown, i, frames, s.slug) { idx ->
                // keep the tile we're viewing on screen so closing flies into it
                scope.launch {
                    val target = headerCount + if (sections != null) momentTileOffset(sections, idx) else idx
                    val visible = grid.layoutInfo.visibleItemsInfo.any { it.index == target }
                    if (!visible) grid.scrollToItem(target)
                }
            })
        },
        header = {
            fullWidth("title") {
                Column(
                    Modifier.padding(horizontal = EditorialSpacing.screenGutter).padding(top = EditorialSpacing.xSmall, bottom = EditorialSpacing.large),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text(s.title, style = EditorialTheme.typography.serif(36.sp), color = EditorialTheme.colors.textPrimary)
                    val n = photos?.size
                    val face = s.faces.firstOrNull { it.faceId == s.selectedFace }
                    EditorialSectionHeader(
                        eyebrow = "Gallery",
                        subtitle = when {
                            n == null -> "Loading…"
                            locked -> "${s.detail?.imageCount ?: n} ${if (n == 1) "photo" else "photos"} · watermarked preview"
                            face != null -> "Just ${face.name ?: "this person"} — $n ${if (n == 1) "photo" else "photos"}"
                            s.revisionOnly -> "$n updated ${if (n == 1) "photo" else "photos"}"
                            view != GalleryView.All -> "$n ${if (n == 1) "photo" else "photos"}"
                            else -> "${s.detail?.imageCount ?: n} ${if (n == 1) "photo" else "photos"}"
                        },
                    )
                }
            }
            if (showViews) {
                fullWidth("views") {
                    val d = s.detail
                    EditorialChipRow(
                        views.map { v ->
                            EditorialChip(
                                when (v) {
                                    GalleryView.Highlights -> "Highlights"
                                    GalleryView.All -> "All"
                                    GalleryView.Moments -> "Moments"
                                },
                                v,
                                when (v) {
                                    GalleryView.Highlights -> d?.let { filterHighlights(it.albumPhotos, it.highlights).size }
                                    GalleryView.All -> d?.albumPhotos?.size
                                    GalleryView.Moments -> d?.let { momentSections(it.albumPhotos, it.moments).size }
                                },
                            )
                        },
                        selection = view,
                        onSelect = { chosen = it },
                        modifier = Modifier.padding(horizontal = EditorialSpacing.screenGutter).padding(bottom = EditorialSpacing.large),
                    )
                }
            }
            s.detail?.takeIf { it.locked }?.let { d ->
                fullWidth("proof") {
                    ProofBanner(
                        d.bookingNumber, d.slug, studio = !Session.isClient, onOpenBooking = onOpenBooking,
                        modifier = Modifier.padding(horizontal = EditorialSpacing.screenGutter).padding(bottom = EditorialSpacing.large),
                    )
                }
            }
            s.revision?.let { rev ->
                fullWidth("revision") {
                    RevisionBanner(
                        rev,
                        only = s.revisionOnly,
                        onOnly = { store.send(AlbumIntent.RevisionOnly(it)) },
                        modifier = Modifier.padding(horizontal = EditorialSpacing.screenGutter).padding(bottom = EditorialSpacing.large),
                    )
                }
            }
            if (s.faces.isNotEmpty()) {
                fullWidth("faces") {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = EditorialSpacing.screenGutter),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        modifier = Modifier.padding(bottom = EditorialSpacing.large),
                    ) {
                        items(s.faces, key = { it.faceId }) { f ->
                            EditorialFaceChip(
                                onClick = { store.send(AlbumIntent.SelectFace(f.faceId)) },
                                name = f.name,
                                count = f.count,
                                isActive = s.selectedFace == f.faceId,
                            ) { RemoteImage(f.imageUrl, Modifier.fillMaxSize()) }
                        }
                    }
                }
            }
            if (s.error != null && s.detail == null) {
                fullWidth("error") {
                    EditorialEmptyState(
                        Icons.Outlined.Warning, "Couldn't load", Modifier.padding(EditorialSpacing.screenGutter),
                        subtitle = s.error, actionTitle = "Try again", onAction = { store.send(AlbumIntent.Refresh) },
                    )
                }
            } else if (photos?.isEmpty() == true) {
                fullWidth("empty") {
                    EditorialEmptyState(
                        Icons.Outlined.PhotoLibrary, "No photos", Modifier.padding(EditorialSpacing.screenGutter),
                        subtitle = when {
                            s.selectedFace != null -> "No photos of this person in the gallery."
                            s.revisionOnly -> "None of the updated photos are in this view."
                            else -> "This gallery is empty."
                        },
                    )
                }
            }
        },
    )

    pinned?.let { MomentHeader(it, Modifier.padding(top = topInset)) }

    EditorialTopBar(
        onBack = onBack,
        action = if (!locked && s.detail?.albumPhotos?.isNotEmpty() == true) {
            { actions = true }
        } else null,
        actionIcon = Icons.Outlined.Download,
        actionLabel = "Get your photos",
    )
    }

    if (actions) {
        val d = s.detail
        if (d != null && !d.locked) GalleryActionsSheet(d.albumName, d.slug, d.secret, d.albumPhotos) { actions = false }
    }
}

/** "Revision 2 · 14 photos updated", the photographer's note, and a switch to just those photos. */
@Composable
private fun RevisionBanner(rev: AlbumRevision, only: Boolean, onOnly: (Boolean) -> Unit, modifier: Modifier = Modifier) {
    val c = EditorialTheme.colors
    val count = "${rev.photoCount} ${if (rev.photoCount == 1) "photo" else "photos"} updated"
    Row(modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Box(Modifier.width(2.dp).fillMaxHeight().background(c.brand))
        Column(Modifier.padding(start = EditorialSpacing.medium), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
            EditorialEyebrow("Revision ${rev.number} · $count")
            rev.note?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = EditorialTheme.typography.body, color = c.textSecondary)
            }
            EditorialSegmentedControl(
                listOf("All photos" to false, "Updated only" to true),
                selection = only,
                onSelect = onOnly,
                modifier = Modifier.padding(top = EditorialSpacing.xSmall),
            )
        }
    }
}

/** "Cake cutting · 4:12 PM–4:40 PM · 24". Fixed height so the pinned copy lines up with the real one. */
@Composable
private fun MomentHeader(section: MomentSection, modifier: Modifier = Modifier) {
    val c = EditorialTheme.colors
    Box(modifier.fillMaxWidth().height(44.dp).background(c.background)) {
        Text(
            momentTitle(section.moment.label, formatMomentRange(section.moment.start, section.moment.end), section.photos.size).uppercase(),
            Modifier.align(Alignment.CenterStart).padding(horizontal = EditorialSpacing.screenGutter),
            style = EditorialTheme.typography.label(11.sp, 1.7.sp),
            color = c.textSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Box(Modifier.align(Alignment.BottomStart).fillMaxWidth().height(1.dp).background(c.borderSubtle))
    }
}
