package com.radsoftinc.photoaura.features.home

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Collections
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.FolderZip
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.SaveAlt
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialButtonStyle
import com.radsoftinc.editorialstyle.EditorialCard
import com.radsoftinc.editorialstyle.EditorialEmptyState
import com.radsoftinc.editorialstyle.EditorialEyebrow
import com.radsoftinc.editorialstyle.EditorialLargeTitle
import com.radsoftinc.editorialstyle.EditorialPhotoCard
import com.radsoftinc.editorialstyle.EditorialSkeleton
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTypography
import com.radsoftinc.editorialstyle.editorialPress
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.ClientFile
import com.radsoftinc.photoaura.core.HomeAlbum
import com.radsoftinc.photoaura.core.HomeSummary
import com.radsoftinc.photoaura.core.ImageUrls
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.ui.ActionCard
import com.radsoftinc.photoaura.ui.RemoteImage
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

data class HomeState(val summary: HomeSummary? = null, val loading: Boolean = true, val error: String? = null)

sealed interface HomeIntent {
    data object Load : HomeIntent
    data class Loaded(val s: HomeSummary) : HomeIntent
    data class Failed(val m: String) : HomeIntent
}

class HomeStore : Store<HomeState, HomeIntent>(HomeState()) {
    init { send(HomeIntent.Load) }

    override fun send(intent: HomeIntent) {
        when (intent) {
            HomeIntent.Load -> {
                setState { copy(loading = true, error = null) }
                io { try { send(HomeIntent.Loaded(Api.home())) } catch (e: Exception) { send(HomeIntent.Failed(e.friendly())) } }
            }
            is HomeIntent.Loaded -> setState { copy(summary = intent.s, loading = false) }
            is HomeIntent.Failed -> setState { copy(loading = false, error = intent.m) }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenAlbum: (slug: String, name: String, actions: Boolean) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp,
    store: HomeStore = viewModel(),
) {
    val s by store.state.collectAsStateWithLifecycle()
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val gutter = EditorialSpacing.screenGutter
    PullToRefreshBox(
        isRefreshing = s.loading && s.summary != null,
        onRefresh = { store.send(HomeIntent.Load) },
        modifier = Modifier.fillMaxSize().background(EditorialTheme.colors.background),
    ) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            contentPadding = PaddingValues(start = gutter, end = gutter, top = top + EditorialSpacing.xLarge, bottom = bottomPadding + EditorialSpacing.xxxLarge),
            horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.small),
            verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small),
            modifier = Modifier.fillMaxSize(),
        ) {
            full { EditorialLargeTitle("Home", Modifier.padding(bottom = EditorialSpacing.small)) }
            val home = s.summary
            val newest = home?.albums?.firstOrNull()
            when {
                s.loading && home == null -> {
                    full { EditorialSkeleton(Modifier.width(260.dp).height(80.dp)) }
                    full { EditorialSkeleton(Modifier.fillMaxWidth().aspectRatio(4f / 3f)) }
                }
                s.error != null && home == null -> full {
                    EditorialEmptyState(
                        Icons.Outlined.Warning, "Couldn't load",
                        subtitle = s.error, actionTitle = "Try again", onAction = { store.send(HomeIntent.Load) },
                    )
                }
                home == null || newest == null -> full {
                    EditorialEmptyState(
                        Icons.Outlined.PhotoLibrary, "Nothing here yet",
                        subtitle = "Your photographer hasn't shared a gallery with you yet. You'll get an email when they do.",
                    )
                }
                else -> {
                    full { Welcome(home) }
                    full { Spacer(Modifier.height(EditorialSpacing.small)) }
                    full { Hero(newest, multiple = home.albums.size > 1) { onOpenAlbum(newest.slug, newest.name, false) } }
                    full { Spacer(Modifier.height(EditorialSpacing.large)) }
                    full {
                        GetPhotos(
                            newest,
                            onSave = { onOpenAlbum(newest.slug, newest.name, true) },
                            onBrowse = { onOpenAlbum(newest.slug, newest.name, false) },
                        )
                    }
                    if (home.files.isNotEmpty()) {
                        full { Spacer(Modifier.height(EditorialSpacing.large)) }
                        full { Files(home.files) }
                    }
                    val rest = home.albums.drop(1)
                    if (rest.isNotEmpty()) {
                        full { Spacer(Modifier.height(EditorialSpacing.xLarge)) }
                        full { EditorialEyebrow("Earlier galleries", color = EditorialTheme.colors.textMuted) }
                        items(rest, key = { it.id }) { a ->
                            EditorialPhotoCard(a.name, caption = counts(a), aspect = 4f / 5f, onClick = { onOpenAlbum(a.slug, a.name, false) }) {
                                a.cover?.let { RemoteImage(ImageUrls.upright(it, ImageUrls.TILE), Modifier.fillMaxSize()) }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun LazyGridScope.full(content: @Composable () -> Unit) =
    item(span = { GridItemSpan(maxLineSpan) }) { content() }

@Composable
private fun Welcome(home: HomeSummary) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Column {
        Text(home.firstName?.let { "Hi $it." } ?: "Welcome.", style = type.serif(34.sp), color = c.textPrimary)
        Text(
            if (home.albums.size == 1) "Your gallery is ready." else "${home.albums.size} galleries are ready.",
            style = type.serif(34.sp), color = c.textSecondary, maxLines = 1,
        )
        Spacer(Modifier.height(EditorialSpacing.medium))
        Row(horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.large)) {
            Stat(Icons.Outlined.Collections, home.totals.photos, "photos")
            if (home.totals.videos > 0) Stat(Icons.Outlined.Movie, home.totals.videos, "videos")
            if (home.totals.files > 0) Stat(Icons.Outlined.FolderZip, home.totals.files, "to download")
        }
    }
}

@Composable
private fun Stat(icon: ImageVector, n: Int, label: String) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(16.dp), tint = c.brand)
        Spacer(Modifier.width(EditorialSpacing.xSmall))
        Text("$n", style = type.serif(22.sp), color = c.textPrimary)
        Spacer(Modifier.width(EditorialSpacing.xSmall))
        Text(label.uppercase(), style = type.label(10.sp, 3.sp), color = c.textMuted)
    }
}

@Composable
private fun Hero(a: HomeAlbum, multiple: Boolean, onClick: () -> Unit) {
    val type = EditorialTheme.typography
    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(4f / 3f)
            .background(EditorialTheme.colors.surfaceCard)
            .editorialPress(onClick = onClick),
    ) {
        a.cover?.let { RemoteImage(ImageUrls.upright(it, ImageUrls.TILE), Modifier.fillMaxSize()) }
        Box(
            Modifier.fillMaxWidth().fillMaxHeight(0.6f).align(Alignment.BottomCenter)
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f), Color.Black.copy(alpha = 0.85f)))),
        )
        Row(Modifier.align(Alignment.BottomStart).padding(EditorialSpacing.large), verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f)) {
                val lead = if (multiple) "NEWEST" else "GALLERY"
                Text(prettyDate(a.date)?.let { "$lead · ${it.uppercase()}" } ?: lead, style = type.label(10.sp, 3.sp), color = Color.White.copy(alpha = 0.7f))
                Spacer(Modifier.height(6.dp))
                Text(a.name, style = type.serif(28.sp), color = Color.White, maxLines = 2)
                Text(counts(a), style = type.sans(EditorialTypography.Size.caption), color = Color.White.copy(alpha = 0.72f))
            }
            Box(Modifier.size(42.dp).border(1.dp, Color.White.copy(alpha = 0.4f)), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Outlined.ArrowForward, "Open", Modifier.size(18.dp), tint = Color.White)
            }
        }
    }
}

@Composable
private fun GetPhotos(a: HomeAlbum, onSave: () -> Unit, onBrowse: () -> Unit) {
    val c = EditorialTheme.colors
    EditorialCard(padding = PaddingValues(EditorialSpacing.large), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        EditorialEyebrow("Get your photos", color = c.textMuted)
        EditorialButton("Save all to your gallery", onSave, icon = Icons.Outlined.SaveAlt)
        EditorialButton("Browse the gallery", onBrowse, style = EditorialButtonStyle.Secondary, icon = Icons.Outlined.Collections)
        Text(
            "Every one of the ${a.photoCount} originals goes straight into your gallery, full quality. You can also share the gallery or grab a zip from inside it.",
            style = EditorialTheme.typography.hint, color = c.textMuted,
        )
    }
}

@Composable
private fun Files(files: List<ClientFile>) {
    val ctx = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        EditorialEyebrow("Ready to download", color = EditorialTheme.colors.textMuted)
        files.forEach { f ->
            ActionCard(
                if (f.filename.endsWith(".zip", true)) Icons.Outlined.FolderZip else Icons.Outlined.Description,
                f.filename,
                listOfNotNull(f.albumName, f.size?.let(::bytes)).joinToString(" · "),
                Icons.Outlined.Download,
                trailingTint = EditorialTheme.colors.brand,
                enabled = f.downloadUrl != null,
            ) { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(f.downloadUrl))) }
        }
    }
}

private fun counts(a: HomeAlbum): String {
    val bits = mutableListOf("${a.photoCount} ${if (a.photoCount == 1) "photo" else "photos"}")
    if (a.videoCount > 0) bits += "${a.videoCount} ${if (a.videoCount == 1) "video" else "videos"}"
    return bits.joinToString(" · ")
}

private fun bytes(n: Long): String = when {
    n >= 1_073_741_824 -> String.format("%.1f GB", n / 1_073_741_824.0)
    n >= 1_048_576 -> String.format("%.1f MB", n / 1_048_576.0)
    else -> "${n / 1024} KB"
}

// album dates are free text; only tidy the ones that parse
private fun prettyDate(s: String?): String? {
    if (s.isNullOrBlank()) return null
    val out = DateTimeFormatter.ofPattern("MMMM d, yyyy")
    listOf("yyyy-MM-dd HH:mm:ss.SSSSSS", "yyyy-MM-dd HH:mm:ss").forEach { p ->
        runCatching { return LocalDateTime.parse(s, DateTimeFormatter.ofPattern(p)).format(out) }
    }
    runCatching { return LocalDate.parse(s).format(out) }
    return s
}
