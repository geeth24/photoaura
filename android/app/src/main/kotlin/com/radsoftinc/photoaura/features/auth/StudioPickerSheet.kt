package com.radsoftinc.photoaura.features.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Camera
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.UnfoldMore
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.radsoftinc.photoaura.core.Studio
import com.radsoftinc.photoaura.core.Studios
import com.radsoftinc.photoaura.ui.AuraField
import com.radsoftinc.photoaura.ui.BrandButton
import com.radsoftinc.photoaura.ui.Eyebrow
import com.radsoftinc.photoaura.ui.Hairline
import com.radsoftinc.photoaura.ui.SecondaryButton
import com.radsoftinc.photoaura.ui.Type
import com.radsoftinc.photoaura.ui.aura

/** The "Studio" field on sign-in; tapping it opens the picker. */
@Composable
fun StudioField(onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(56.dp)
            .background(aura.surfaceElevated)
            .border(1.dp, aura.borderDefault)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("STUDIO", style = Type.eyebrow(10, 0.25.em), color = aura.textMuted)
            Text(Studios.selected.name, style = Type.sans(15).copy(fontWeight = FontWeight.Medium), color = aura.textPrimary, maxLines = 1)
        }
        Icon(Icons.Outlined.UnfoldMore, null, Modifier.size(18.dp), tint = aura.textMuted)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudioPickerSheet(onDismiss: () -> Unit) {
    var adding by remember { mutableStateOf(false) }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = aura.background,
    ) {
        Column(
            Modifier.fillMaxWidth().imePadding().padding(horizontal = 24.dp).padding(bottom = 36.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            if (adding) {
                AddStudio(onDone = onDismiss, onCancel = { adding = false })
            } else {
                Text("Choose studio", style = Type.serif(20), color = aura.textPrimary, modifier = Modifier.align(Alignment.CenterHorizontally))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Eyebrow("Photographer")
                    Text("Pick the studio that shared your gallery.", style = Type.sans(15), color = aura.textSecondary)
                }
                Column {
                    Studios.all.forEach { studio ->
                        StudioRow(studio) { Studios.select(studio); onDismiss() }
                        Hairline()
                    }
                }
                SecondaryButton("Add a custom studio") { adding = true }
            }
        }
    }
}

@Composable
private fun StudioRow(studio: Studio, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            if (studio.builtIn) Icons.Outlined.Camera else Icons.Outlined.Language, null,
            Modifier.size(20.dp), tint = aura.textMuted,
        )
        Spacer(Modifier.width(16.dp))
        Column(Modifier.weight(1f)) {
            Text(studio.name, style = Type.sans(16).copy(fontWeight = FontWeight.Medium), color = aura.textPrimary)
            Text(studio.host, style = Type.sans(13), color = aura.textMuted)
        }
        if (studio.id == Studios.selectedId) {
            Icon(Icons.Outlined.Check, "Selected", Modifier.size(18.dp), tint = aura.brand)
        }
        // no swipe-to-delete on Android, so custom studios get a remove button
        if (!studio.builtIn) {
            Icon(
                Icons.Outlined.Close, "Remove ${studio.name}",
                Modifier.padding(start = 12.dp).size(18.dp).clickable { Studios.remove(studio) },
                tint = aura.textMuted,
            )
        }
    }
}

@Composable
private fun AddStudio(onDone: () -> Unit, onCancel: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    Text("New studio", style = Type.serif(20), color = aura.textPrimary, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Eyebrow("Custom studio")
        Text("Your photographer should have shared a server URL with you.", style = Type.sans(15), color = aura.textSecondary)
    }
    AuraField(name, { name = it }, "Studio name", "e.g. Bright Studio")
    AuraField(
        url, { url = it; error = null }, "API URL", "https://aura-api.example.com/api",
        keyboard = KeyboardType.Uri, error = error,
    )
    BrandButton("Add studio", enabled = name.isNotBlank() && url.isNotBlank()) {
        val u = url.trim()
        val scheme = runCatching { java.net.URI(u).scheme?.lowercase() }.getOrNull()
        if ((scheme != "https" && scheme != "http") || runCatching { java.net.URI(u).host }.getOrNull() == null) {
            error = "Enter a full URL including https://"
            return@BrandButton
        }
        Studios.select(Studios.add(name.trim(), u))
        onDone()
    }
    SecondaryButton("Cancel", onClick = onCancel)
}
