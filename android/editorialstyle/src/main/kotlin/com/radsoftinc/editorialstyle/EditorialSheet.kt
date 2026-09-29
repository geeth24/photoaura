package com.radsoftinc.editorialstyle

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/** Full-height bottom sheet on the editorial background, with an optional inline serif title. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorialSheet(
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null,
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(EditorialSpacing.large),
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = EditorialTheme.colors
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = c.background,
    ) {
        Column(
            modifier
                .fillMaxWidth()
                .imePadding()
                .padding(horizontal = EditorialSpacing.screenGutter)
                .padding(bottom = EditorialSpacing.xxxLarge),
            verticalArrangement = verticalArrangement,
        ) {
            if (title != null) {
                Text(
                    title,
                    style = EditorialTheme.typography.serif(18.sp).copy(letterSpacing = EditorialTypography.Tracking.headingTight),
                    color = c.textPrimary,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
            }
            content()
        }
    }
}

/** "Are you sure?" sheet for sign out, delete and the like. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorialConfirmSheet(
    title: String,
    primaryLabel: String,
    onConfirm: () -> Unit,
    onDismissRequest: () -> Unit,
    message: String? = null,
    icon: ImageVector? = null,
    isDestructive: Boolean = false,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    // let the sheet slide away before the caller drops it
    fun close(then: () -> Unit = {}) {
        scope.launch { state.hide() }.invokeOnCompletion { then(); onDismissRequest() }
    }

    ModalBottomSheet(onDismissRequest = onDismissRequest, sheetState = state, containerColor = c.background) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = EditorialSpacing.screenGutter)
                .padding(top = EditorialSpacing.small, bottom = EditorialSpacing.xxxLarge),
            verticalArrangement = Arrangement.spacedBy(EditorialSpacing.large),
        ) {
            if (icon != null) {
                Icon(icon, null, Modifier.size(28.dp), tint = if (isDestructive) c.error else c.brand)
            }
            Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
                Text(title, style = type.heading, color = c.textPrimary)
                if (message != null) Text(message, style = type.subtitle, color = c.textSecondary)
            }
            Column(
                Modifier.padding(top = EditorialSpacing.medium),
                verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small),
            ) {
                EditorialButton(
                    primaryLabel,
                    { close(onConfirm) },
                    style = if (isDestructive) EditorialButtonStyle.Destructive else EditorialButtonStyle.Primary,
                )
                EditorialButton("Cancel", { close() }, style = EditorialButtonStyle.Ghost)
            }
        }
    }
}
