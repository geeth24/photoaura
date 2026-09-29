package com.radsoftinc.photoaura.features.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.radsoftinc.photoaura.BuildConfig
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.ui.AuraField
import com.radsoftinc.photoaura.ui.BrandButton
import com.radsoftinc.photoaura.ui.Eyebrow
import com.radsoftinc.photoaura.ui.Hairline
import com.radsoftinc.photoaura.ui.Type
import com.radsoftinc.photoaura.ui.aura
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(bottomPadding: Dp) {
    val user = Session.user ?: return
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var confirmSignOut by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    fun open(url: String) = ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

    Column(
        Modifier
            .fillMaxSize()
            .background(aura.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(top = top + 24.dp, bottom = bottomPadding + 40.dp),
    ) {
        Text("Account", style = Type.serif(40), color = aura.textPrimary)
        Spacer(Modifier.height(24.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(64.dp).background(aura.surfaceCard), contentAlignment = Alignment.Center) {
                val initials = user.fullName.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1).uppercase() }
                Text(initials.ifEmpty { "?" }, style = Type.sans(20, FontWeight.Medium), color = aura.brand)
            }
            Spacer(Modifier.width(16.dp))
            Column {
                Text(user.fullName.ifBlank { user.userName ?: "" }, style = Type.serif(24), color = aura.textPrimary)
                Text(user.userEmail, style = Type.sans(14), color = aura.textMuted)
                Spacer(Modifier.height(6.dp))
                Text(
                    (user.role ?: "client").uppercase(),
                    style = Type.eyebrow(10), color = aura.textSecondary,
                    modifier = Modifier.border(1.dp, aura.borderDefault).padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
        }

        Spacer(Modifier.height(32.dp))
        Eyebrow("App")
        Spacer(Modifier.height(8.dp))
        Text("About", style = Type.serif(28), color = aura.textPrimary)
        Spacer(Modifier.height(8.dp))
        Row(Icons.Outlined.Badge, "Edit profile", "@${user.userName ?: ""}", chevron = true) { editing = true }
        Hairline()
        Row(Icons.Outlined.ManageAccounts, "Manage account", "Add emails, change settings", external = true) { open("${Api.WEB}/profile") }
        Hairline()
        Row(Icons.Outlined.Email, "Need help?", "hello@reactiveshots.com", external = true) { open("mailto:hello@reactiveshots.com") }
        Hairline()
        Row(Icons.Outlined.PhoneAndroid, "Version", "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
        Hairline()

        Spacer(Modifier.height(28.dp))
        Box(
            Modifier.fillMaxWidth().background(aura.surfaceElevated).border(1.dp, aura.borderDefault)
                .clickable { confirmSignOut = true }.padding(vertical = 18.dp),
            contentAlignment = Alignment.Center,
        ) { Text("SIGN OUT", style = Type.eyebrow(12), color = aura.textPrimary) }

        Spacer(Modifier.height(40.dp))
        Eyebrow("Account")
        Spacer(Modifier.height(8.dp))
        Text("Danger zone", style = Type.serif(28), color = aura.textPrimary)
        Spacer(Modifier.height(14.dp))
        Box(
            Modifier.fillMaxWidth().border(1.dp, aura.error.copy(alpha = 0.6f)).clickable { confirmDelete = true }.padding(vertical = 18.dp),
            contentAlignment = Alignment.Center,
        ) { Text("DELETE MY ACCOUNT", style = Type.eyebrow(12), color = aura.error) }
        Spacer(Modifier.height(10.dp))
        Text("Permanently removes your account, gallery access, and linked emails. This can't be undone.", style = Type.sans(13), color = aura.textMuted)
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out?") },
            text = { Text("You'll need a new sign-in link to get back in.") },
            confirmButton = { TextButton({ confirmSignOut = false; Session.signOut() }) { Text("Sign out") } },
            dismissButton = { TextButton({ confirmSignOut = false }) { Text("Cancel") } },
        )
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete your account?") },
            text = { Text("This permanently removes your account and access to your galleries.") },
            confirmButton = {
                TextButton({
                    confirmDelete = false
                    scope.launch {
                        runCatching { Api.deleteAccount() }
                            .onSuccess { Session.signOut() }
                            .onFailure { android.widget.Toast.makeText(ctx, it.friendly(), android.widget.Toast.LENGTH_LONG).show() }
                    }
                }) { Text("Delete", color = aura.error) }
            },
            dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel") } },
        )
    }
    if (editing) EditProfileDialog { editing = false }
}

@Composable
private fun Row(icon: ImageVector, title: String, subtitle: String, chevron: Boolean = false, external: Boolean = false, onClick: (() -> Unit)? = null) {
    androidx.compose.foundation.layout.Row(
        Modifier.fillMaxWidth().let { if (onClick != null) it.clickable(onClick = onClick) else it }.padding(vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(22.dp), tint = aura.textSecondary)
        Spacer(Modifier.width(18.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = Type.sans(17, FontWeight.Medium), color = aura.textPrimary)
            Text(subtitle, style = Type.sans(14), color = aura.textMuted)
        }
        when {
            chevron -> Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = aura.textMuted)
            external -> Icon(Icons.AutoMirrored.Outlined.OpenInNew, null, Modifier.size(18.dp), tint = aura.textMuted)
        }
    }
}

@Composable
private fun EditProfileDialog(onDone: () -> Unit) {
    val user = Session.user ?: return
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(user.fullName) }
    var handle by remember { mutableStateOf(user.userName ?: "") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDone,
        containerColor = aura.background,
        title = { Text("Edit profile", style = Type.serif(26), color = aura.textPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                AuraField(name, { name = it; error = null }, "Full name", "Your name")
                AuraField(handle, { handle = it; error = null }, "Username", "username", error = error)
            }
        },
        confirmButton = {
            BrandButton("Save", Modifier.width(140.dp), loading = saving, enabled = name.isNotBlank() && handle.isNotBlank()) {
                saving = true
                scope.launch {
                    runCatching { Api.updateMe(handle.trim(), name.trim()) }
                        .onSuccess { Session.update(it); onDone() }
                        .onFailure { error = it.friendly() }
                    saving = false
                }
            }
        },
        dismissButton = { TextButton(onDone) { Text("Cancel", color = aura.textMuted) } },
    )
}
