package com.radsoftinc.photoaura.features.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Camera
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.UnfoldMore
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialButtonStyle
import com.radsoftinc.editorialstyle.EditorialFieldKind
import com.radsoftinc.editorialstyle.EditorialListRow
import com.radsoftinc.editorialstyle.EditorialMetrics
import com.radsoftinc.editorialstyle.EditorialSectionHeader
import com.radsoftinc.editorialstyle.EditorialSheet
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTextField
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTypography
import com.radsoftinc.photoaura.core.Studio
import com.radsoftinc.photoaura.core.Studios

/** The "Studio" field on sign-in; tapping it opens the picker. */
@Composable
fun StudioField(onClick: () -> Unit) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Row(
        Modifier
            .fillMaxWidth()
            .height(56.dp)
            .background(c.surfaceElevated)
            .border(EditorialMetrics.borderWidth, c.borderDefault)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("STUDIO", style = type.label(), color = c.textMuted)
            Text(
                Studios.selected.name,
                style = type.sans(EditorialTypography.Size.body, FontWeight.Medium),
                color = c.textPrimary,
                maxLines = 1,
            )
        }
        Icon(Icons.Outlined.UnfoldMore, null, Modifier.size(18.dp), tint = c.textMuted)
    }
}

@Composable
fun StudioPickerSheet(onDismiss: () -> Unit) {
    var adding by remember { mutableStateOf(false) }
    EditorialSheet(onDismiss, title = if (adding) "New studio" else "Choose studio") {
        if (adding) {
            AddStudio(onDone = onDismiss, onCancel = { adding = false })
        } else {
            EditorialSectionHeader(eyebrow = "Photographer", subtitle = "Pick the studio that shared your gallery.")
            Column {
                Studios.all.forEach { studio ->
                    StudioRow(studio) { Studios.select(studio); onDismiss() }
                }
            }
            EditorialButton(
                "Add a custom studio", { adding = true },
                Modifier.padding(top = EditorialSpacing.xSmall),
                style = EditorialButtonStyle.Secondary,
            )
        }
    }
}

@Composable
private fun StudioRow(studio: Studio, onClick: () -> Unit) {
    val c = EditorialTheme.colors
    EditorialListRow(
        title = studio.name,
        subtitle = studio.host,
        onClick = onClick,
        leading = {
            Box(Modifier.size(36.dp), contentAlignment = Alignment.Center) {
                Icon(if (studio.builtIn) Icons.Outlined.Camera else Icons.Outlined.Language, null, Modifier.size(20.dp), tint = c.textMuted)
            }
        },
        trailing = {
            if (studio.id == Studios.selectedId) {
                Icon(Icons.Outlined.Check, "Selected", Modifier.size(18.dp), tint = c.brand)
            }
            // no swipe-to-delete on Android, so custom studios get a remove button
            if (!studio.builtIn) {
                Icon(
                    Icons.Outlined.Close, "Remove ${studio.name}",
                    Modifier.padding(start = 12.dp).size(18.dp).clickable { Studios.remove(studio) },
                    tint = c.textMuted,
                )
            }
        },
    )
}

@Composable
private fun AddStudio(onDone: () -> Unit, onCancel: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    EditorialSectionHeader(eyebrow = "Custom studio", subtitle = "Your photographer should have shared a server URL with you.")
    Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
        EditorialTextField(name, { name = it }, "e.g. Bright Studio", label = "Studio name")
        EditorialTextField(
            url, { url = it; error = null }, "https://aura-api.example.com/api",
            label = "API URL", kind = EditorialFieldKind.Uri, footnote = error, isError = error != null,
        )
        EditorialButton("Add studio", {
            val u = url.trim()
            val scheme = runCatching { java.net.URI(u).scheme?.lowercase() }.getOrNull()
            if ((scheme != "https" && scheme != "http") || runCatching { java.net.URI(u).host }.getOrNull() == null) {
                error = "Enter a full URL including https://"
                return@EditorialButton
            }
            Studios.select(Studios.add(name.trim(), u))
            onDone()
        }, isDisabled = name.isBlank() || url.isBlank())
        EditorialButton("Cancel", onCancel, style = EditorialButtonStyle.Ghost)
    }
}
