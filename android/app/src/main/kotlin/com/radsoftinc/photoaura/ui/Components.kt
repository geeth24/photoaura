package com.radsoftinc.photoaura.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.radsoftinc.editorialstyle.EditorialCard
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTypography

/** Crossfaded remote image; Coil's memory cache makes the tile→viewer handoff instant. */
@Composable
fun RemoteImage(
    url: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    crossfade: Boolean = true,
    placeholder: String? = null,
) {
    val ctx = LocalContext.current
    AsyncImage(
        model = ImageRequest.Builder(ctx).data(url).crossfade(crossfade)
            .apply { placeholder?.let { placeholderMemoryCacheKey(it) } }
            .build(),
        contentDescription = null,
        modifier = modifier,
        contentScale = contentScale,
    )
}

/** Carded row with a tinted icon tile, for "do this with your photos" actions and downloads. */
@Composable
fun ActionCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    trailing: ImageVector,
    modifier: Modifier = Modifier,
    prominent: Boolean = false,
    trailingTint: Color? = null,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    EditorialCard(modifier, padding = PaddingValues(EditorialSpacing.medium), onClick = if (enabled) onClick else null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(40.dp).background(if (prominent) c.brand else c.brand.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) { Icon(icon, null, Modifier.size(18.dp), tint = if (prominent) c.background else c.brand) }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    title,
                    style = type.sans(EditorialTypography.Size.body, FontWeight.Medium),
                    color = c.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(subtitle, style = type.sans(EditorialTypography.Size.hint), color = c.textMuted)
            }
            Icon(trailing, null, Modifier.size(20.dp), tint = trailingTint ?: c.textMuted)
        }
    }
}
