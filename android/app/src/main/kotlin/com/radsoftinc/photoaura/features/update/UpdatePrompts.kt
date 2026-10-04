package com.radsoftinc.photoaura.features.update

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.SystemUpdate
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialConfirmSheet
import com.radsoftinc.editorialstyle.EditorialSectionHeader
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.photoaura.BuildConfig
import com.radsoftinc.photoaura.core.AppPolicy
import com.radsoftinc.photoaura.core.AppUpdate

/** Whatever the update policy calls for right now; sits above every other screen. */
@Composable
fun UpdatePrompts() {
    val required = AppUpdate.required
    val suggested = AppUpdate.suggested
    when {
        required != null -> UpdateRequired(required)
        suggested != null -> {
            val ctx = LocalContext.current
            EditorialConfirmSheet(
                title = "A new version is available",
                message = suggested.message ?: "PhotoAura ${suggested.latestVersion} is on Google Play.",
                primaryLabel = "Update",
                dismissLabel = "Not now",
                icon = Icons.Outlined.SystemUpdate,
                onConfirm = { AppUpdate.openStore(ctx, suggested.storeUrl) },
                onDismissRequest = { AppUpdate.dismissSuggestion() },
            )
        }
    }
}

// a dialog window so it also covers sheets that were already open; back does nothing
@Composable
private fun UpdateRequired(p: AppPolicy) {
    val ctx = LocalContext.current
    val c = EditorialTheme.colors
    Dialog(
        onDismissRequest = {},
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false,
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
    ) {
        // the dialog has its own window, so its bar icons don't follow the activity's
        val view = LocalView.current
        val light = !isSystemInDarkTheme()
        SideEffect {
            (view.parent as? DialogWindowProvider)?.window?.let {
                WindowCompat.getInsetsController(it, view).apply {
                    isAppearanceLightStatusBars = light
                    isAppearanceLightNavigationBars = light
                }
            }
        }
        Box(Modifier.fillMaxSize().background(c.background).systemBarsPadding(), contentAlignment = Alignment.Center) {
            Column(
                Modifier.fillMaxWidth().widthIn(max = 480.dp).padding(horizontal = EditorialSpacing.xLarge),
                verticalArrangement = Arrangement.spacedBy(EditorialSpacing.large),
            ) {
                Icon(Icons.Outlined.SystemUpdate, null, Modifier.size(32.dp), tint = c.brand)
                EditorialSectionHeader(
                    eyebrow = "PhotoAura",
                    title = "Update required",
                    subtitle = p.message ?: "This version of PhotoAura is no longer supported. Update to keep seeing your galleries.",
                )
                Spacer(Modifier.height(EditorialSpacing.small))
                EditorialButton("Update", { AppUpdate.openStore(ctx, p.storeUrl) }, icon = Icons.Outlined.SystemUpdate)
                Text(
                    "You have ${BuildConfig.VERSION_NAME}" + (p.minVersion?.let { " · $it or newer is needed" } ?: ""),
                    style = EditorialTheme.typography.hint,
                    color = c.textMuted,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
            }
        }
    }
}
