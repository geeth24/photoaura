package com.radsoftinc.photoaura.features.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.radsoftinc.photoaura.ui.aura

val TopBarHeight = 64.dp

/** Floating back + action buttons over a scrolling screen, with a fade so content slides under it. */
@Composable
fun ScreenTopBar(
    onBack: (() -> Unit)?,
    action: (() -> Unit)? = null,
    actionIcon: ImageVector? = null,
    actionLabel: String? = null,
) {
    Box(
        Modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(aura.background, aura.background.copy(alpha = 0.85f), aura.background.copy(alpha = 0f))))
            .statusBarsPadding()
            .height(TopBarHeight)
            .padding(horizontal = 16.dp),
    ) {
        if (onBack != null) {
            RoundButton(Icons.AutoMirrored.Outlined.ArrowBack, "Back", Modifier.align(Alignment.CenterStart), onBack)
        }
        if (action != null && actionIcon != null) {
            RoundButton(actionIcon, actionLabel ?: "", Modifier.align(Alignment.CenterEnd), action, tint = true)
        }
    }
}

@Composable
private fun RoundButton(icon: ImageVector, label: String, modifier: Modifier, onClick: () -> Unit, tint: Boolean = false) {
    Box(
        modifier.size(44.dp).clip(CircleShape).background(aura.surfaceCard).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, label, Modifier.size(20.dp), tint = if (tint) aura.brand else aura.textPrimary) }
}
