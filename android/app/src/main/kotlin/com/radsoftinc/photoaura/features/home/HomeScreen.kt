package com.radsoftinc.photoaura.features.home

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.ClientFile
import com.radsoftinc.photoaura.core.HomeAlbum
import com.radsoftinc.photoaura.core.HomeSummary
import com.radsoftinc.photoaura.core.ImageUrls
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.ui.BrandButton
import com.radsoftinc.photoaura.ui.EmptyState
import com.radsoftinc.photoaura.ui.Eyebrow
import com.radsoftinc.photoaura.ui.RemoteImage
import com.radsoftinc.photoaura.ui.SecondaryButton
import com.radsoftinc.photoaura.ui.Skeleton
import com.radsoftinc.photoaura.ui.Type
import com.radsoftinc.photoaura.ui.aura
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
    PullToRefreshBox(
        isRefreshing = s.loading && s.summary != null,
        onRefresh = { store.send(HomeIntent.Load) },
        modifier = Modifier.fillMaxSize().background(aura.background),
    ) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            contentPadding = PaddingValues(start = 24.dp, end = 24.dp, top = top + 24.dp, bottom = bottomPadding + 40.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            full { Text("Home", style = Type.serif(40), color = aura.textPrimary, modifier = Modifier.padding(bottom = 12.dp)) }
            val home = s.summary
            val newest = home?.albums?.firstOrNull()
            when {
                s.loading && home == null -> {
                    full { Skeleton(Modifier.width(260.dp).height(80.dp)) }
                    full { Skeleton(Modifier.fillMaxWidth().aspectRatio(4f / 3f)) }
                }
                s.error != null && home == null -> full {
                    EmptyState(Icons.Outlined.Warning, "Couldn't load", s.error!!, "Try again") { store.send(HomeIntent.Load) }
                }
                home == null || newest == null -> full {
                    EmptyState(
                        Icons.Outlined.PhotoLibrary, "Nothing here yet",
                        "Your photographer hasn't shared a gallery with you yet. You'll get an email when they do.",
                    )
                }
                else -> {
                    full { Welcome(home) }
                    full { Spacer(Modifier.height(12.dp)) }
                    full { Hero(newest, multiple = home.albums.size > 1) { onOpenAlbum(newest.slug, newest.name, false) } }
                    full { Spacer(Modifier.height(20.dp)) }
                    full {
                        GetPhotos(
                            newest,
                            onSave = { onOpenAlbum(newest.slug, newest.name, true) },
                            onBrowse = { onOpenAlbum(newest.slug, newest.name, false) },
                        )
                    }
                    if (home.files.isNotEmpty()) {
                        full { Spacer(Modifier.height(20.dp)) }
                        full { Files(home.files) }
                    }
                    val rest = home.albums.drop(1)
                    if (rest.isNotEmpty()) {
                        full { Spacer(Modifier.height(24.dp)) }
                        full { Eyebrow("Earlier galleries", line = false) }
                        items(rest, key = { it.id }) { a -> Card(a) { onOpenAlbum(a.slug, a.name, false) } }
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
    Column {
        Text(home.firstName?.let { "Hi $it." } ?: "Welcome.", style = Type.serif(34), color = aura.textPrimary)
        Text(
            if (home.albums.size == 1) "Your gallery is ready." else "${home.albums.size} galleries are ready.",
            style = Type.serif(34), color = aura.textSecondary, maxLines = 1,
        )
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            Stat(Icons.Outlined.Collections, home.totals.photos, "photos")
            if (home.totals.videos > 0) Stat(Icons.Outlined.Movie, home.totals.videos, "videos")
            if (home.totals.files > 0) Stat(Icons.Outlined.FolderZip, home.totals.files, "to download")
        }
    }
}

@Composable
private fun Stat(icon: ImageVector, n: Int, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(16.dp), tint = aura.brand)
        Spacer(Modifier.width(8.dp))
        Text("$n", style = Type.serif(22), color = aura.textPrimary)
        Spacer(Modifier.width(8.dp))
        Text(label.uppercase(), style = Type.eyebrow(10), color = aura.textMuted)
    }
}

@Composable
private fun Hero(a: HomeAlbum, multiple: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(4f / 3f)
            .background(aura.surfaceCard)
            .clickable(onClick = onClick),
    ) {
        a.cover?.let { RemoteImage(ImageUrls.upright(it, ImageUrls.TILE), Modifier.fillMaxSize()) }
        Box(
            Modifier.fillMaxWidth().fillMaxHeight(0.6f).align(Alignment.BottomCenter)
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f), Color.Black.copy(alpha = 0.85f)))),
        )
        Row(Modifier.align(Alignment.BottomStart).padding(20.dp), verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f)) {
                val lead = if (multiple) "NEWEST" else "GALLERY"
                Text(prettyDate(a.date)?.let { "$lead · ${it.uppercase()}" } ?: lead, style = Type.eyebrow(10), color = Color.White.copy(alpha = 0.7f))
                Spacer(Modifier.height(6.dp))
                Text(a.name, style = Type.serif(28), color = Color.White, maxLines = 2)
                Text(counts(a), style = Type.sans(13), color = Color.White.copy(alpha = 0.72f))
            }
            Box(Modifier.size(42.dp).border(1.dp, Color.White.copy(alpha = 0.4f)), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Outlined.ArrowForward, "Open", Modifier.size(18.dp), tint = Color.White)
            }
        }
    }
}

@Composable
private fun GetPhotos(a: HomeAlbum, onSave: () -> Unit, onBrowse: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().background(aura.surfaceElevated).border(1.dp, aura.borderSubtle).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Eyebrow("Get your photos", line = false)
        BrandButton("Save all to your gallery", icon = Icons.Outlined.SaveAlt, onClick = onSave)
        SecondaryButton("Browse the gallery", icon = Icons.Outlined.Collections, onClick = onBrowse)
        Text(
            "Every one of the ${a.photoCount} originals goes straight into your gallery, full quality. You can also share the gallery or grab a zip from inside it.",
            style = Type.sans(13), color = aura.textMuted,
        )
    }
}

@Composable
private fun Files(files: List<ClientFile>) {
    val ctx = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Eyebrow("Ready to download", line = false)
        files.forEach { f ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(aura.surfaceElevated)
                    .border(1.dp, aura.borderSubtle)
                    .clickable(enabled = f.downloadUrl != null) {
                        ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(f.downloadUrl)))
                    }
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(40.dp).background(aura.brand.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
                    Icon(if (f.filename.endsWith(".zip", true)) Icons.Outlined.FolderZip else Icons.Outlined.Description, null, tint = aura.brand)
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(f.filename, style = Type.sans(15, FontWeight.Medium), color = aura.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(listOfNotNull(f.albumName, f.size?.let(::bytes)).joinToString(" · "), style = Type.sans(12), color = aura.textMuted)
                }
                Icon(Icons.Outlined.Download, "Download", tint = aura.brand)
            }
        }
    }
}

@Composable
private fun Card(a: HomeAlbum, onClick: () -> Unit) {
    Box(Modifier.fillMaxWidth().aspectRatio(4f / 5f).background(aura.surfaceCard).border(1.dp, aura.borderSubtle).clickable(onClick = onClick)) {
        a.cover?.let { RemoteImage(ImageUrls.upright(it, ImageUrls.TILE), Modifier.fillMaxSize()) }
        Box(
            Modifier.fillMaxWidth().fillMaxHeight(0.55f).align(Alignment.BottomCenter)
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f)))),
        )
        Column(Modifier.align(Alignment.BottomStart).padding(14.dp)) {
            Text(a.name, style = Type.serif(19), color = Color.White, maxLines = 2)
            Text(counts(a).uppercase(), style = Type.eyebrow(9), color = Color.White.copy(alpha = 0.75f))
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
