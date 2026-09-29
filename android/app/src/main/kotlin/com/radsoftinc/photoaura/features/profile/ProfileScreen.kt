package com.radsoftinc.photoaura.features.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radsoftinc.editorialstyle.EditorialAvatar
import com.radsoftinc.editorialstyle.EditorialBadge
import com.radsoftinc.editorialstyle.EditorialBadgeTone
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialButtonStyle
import com.radsoftinc.editorialstyle.EditorialConfirmSheet
import com.radsoftinc.editorialstyle.EditorialLargeTitle
import com.radsoftinc.editorialstyle.EditorialListRow
import com.radsoftinc.editorialstyle.EditorialSectionHeader
import com.radsoftinc.editorialstyle.EditorialSectionHeaderStyle
import com.radsoftinc.editorialstyle.EditorialSheet
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTextField
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTypography
import com.radsoftinc.photoaura.BuildConfig
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.friendly
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(bottomPadding: Dp) {
    val user = Session.user ?: return
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    var confirmSignOut by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    fun open(url: String) = ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

    Column(
        Modifier
            .fillMaxSize()
            .background(c.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = EditorialSpacing.screenGutter)
            .padding(top = top + EditorialSpacing.xLarge, bottom = bottomPadding + EditorialSpacing.xxxLarge),
        verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xLarge),
    ) {
        EditorialLargeTitle("Account")

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
            EditorialAvatar(user.fullName, size = 64.dp)
            Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xxSmall)) {
                Text(user.fullName.ifBlank { user.userName ?: "" }, style = type.serif(22.sp), color = c.textPrimary, maxLines = 1)
                Text(
                    user.userEmail,
                    style = type.sans(EditorialTypography.Size.caption),
                    color = c.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.MiddleEllipsis,
                )
                val role = user.role ?: "client"
                EditorialBadge(
                    role,
                    Modifier.padding(top = EditorialSpacing.xxSmall),
                    tone = if (role.equals("admin", ignoreCase = true)) EditorialBadgeTone.Brand else EditorialBadgeTone.Neutral,
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
            EditorialSectionHeader(
                Modifier.padding(bottom = EditorialSpacing.xSmall),
                title = "About", eyebrow = "App", style = EditorialSectionHeaderStyle.Section,
            )
            Column {
                SettingsRow(Icons.Outlined.Badge, "Edit profile", "@${user.userName ?: ""}", Icons.AutoMirrored.Outlined.KeyboardArrowRight) { editing = true }
                SettingsRow(Icons.Outlined.ManageAccounts, "Manage account", "Add emails, change settings", Icons.AutoMirrored.Outlined.OpenInNew) {
                    open("${Api.WEB}/profile")
                }
                SettingsRow(Icons.Outlined.Email, "Need help?", "hello@reactiveshots.com", Icons.AutoMirrored.Outlined.OpenInNew) {
                    open("mailto:hello@reactiveshots.com")
                }
                EditorialListRow(
                    "Version",
                    leading = { RowIcon(Icons.Outlined.PhoneAndroid) },
                    trailing = {
                        Text("${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})", style = type.sans(EditorialTypography.Size.caption), color = c.textMuted)
                    },
                )
            }
        }

        EditorialButton("Sign out", { confirmSignOut = true }, Modifier.padding(top = EditorialSpacing.medium), style = EditorialButtonStyle.Secondary)

        Column(Modifier.padding(top = EditorialSpacing.xLarge), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
            EditorialSectionHeader(
                Modifier.padding(bottom = EditorialSpacing.xSmall),
                title = "Danger zone", eyebrow = "Account", style = EditorialSectionHeaderStyle.Section,
            )
            EditorialButton(
                if (deleting) "Deleting…" else "Delete my account",
                { confirmDelete = true },
                style = EditorialButtonStyle.Destructive,
                isLoading = deleting,
            )
            Text(
                "Permanently removes your account, gallery access, and linked emails. This can't be undone.",
                Modifier.padding(top = EditorialSpacing.xSmall),
                style = type.hint, color = c.textMuted,
            )
        }
    }

    if (confirmSignOut) {
        EditorialConfirmSheet(
            title = "Sign out?",
            message = "You'll need a new sign-in link to get back in.",
            icon = Icons.AutoMirrored.Outlined.Logout,
            primaryLabel = "Sign out",
            isDestructive = true,
            onConfirm = { Session.signOut() },
            onDismissRequest = { confirmSignOut = false },
        )
    }
    if (confirmDelete) {
        EditorialConfirmSheet(
            title = "Delete your account?",
            message = "This permanently removes your account and access to your galleries.",
            icon = Icons.Outlined.WarningAmber,
            primaryLabel = "Delete my account",
            isDestructive = true,
            onConfirm = {
                deleting = true
                scope.launch {
                    runCatching { Api.deleteAccount() }
                        .onSuccess { Session.signOut() }
                        .onFailure { android.widget.Toast.makeText(ctx, it.friendly(), android.widget.Toast.LENGTH_LONG).show() }
                    deleting = false
                }
            },
            onDismissRequest = { confirmDelete = false },
        )
    }
    if (editing) EditProfileSheet { editing = false }
}

@Composable
private fun RowIcon(icon: ImageVector) {
    Box(Modifier.size(36.dp), contentAlignment = Alignment.Center) {
        Icon(icon, null, Modifier.size(20.dp), tint = EditorialTheme.colors.textMuted)
    }
}

@Composable
private fun SettingsRow(icon: ImageVector, title: String, subtitle: String, trailing: ImageVector, onClick: () -> Unit) {
    EditorialListRow(
        title,
        subtitle = subtitle,
        onClick = onClick,
        leading = { RowIcon(icon) },
        trailing = { Icon(trailing, null, Modifier.size(16.dp), tint = EditorialTheme.colors.textMuted) },
    )
}

@Composable
private fun EditProfileSheet(onDone: () -> Unit) {
    val user = Session.user ?: return
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(user.fullName) }
    var handle by remember { mutableStateOf(user.userName ?: "") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    EditorialSheet(onDone, title = "Edit profile") {
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
            EditorialTextField(name, { name = it; error = null }, "Your name", label = "Full name")
            EditorialTextField(handle, { handle = it; error = null }, "username", label = "Username", footnote = error, isError = error != null)
        }
        EditorialButton("Save", {
            saving = true
            scope.launch {
                runCatching { Api.updateMe(handle.trim(), name.trim()) }
                    .onSuccess { Session.update(it); onDone() }
                    .onFailure { error = it.friendly() }
                saving = false
            }
        }, isLoading = saving, isDisabled = name.isBlank() || handle.isBlank())
        EditorialButton("Cancel", onDone, style = EditorialButtonStyle.Ghost)
    }
}
