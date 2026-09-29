package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp

enum class EditorialFieldKind { Text, Email, Password, Search, Uri }

@Composable
fun EditorialTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    label: String? = null,
    kind: EditorialFieldKind = EditorialFieldKind.Text,
    footnote: String? = null,
    isError: Boolean = false,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    var focused by remember { mutableStateOf(false) }
    val plain = kind == EditorialFieldKind.Text

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
        if (label != null) Text(label.uppercase(), style = type.label(), color = c.textMuted)

        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = type.sans(type.body.fontSize).copy(color = c.textPrimary),
            cursorBrush = SolidColor(c.brand),
            keyboardOptions = KeyboardOptions(
                keyboardType = when (kind) {
                    EditorialFieldKind.Email -> KeyboardType.Email
                    EditorialFieldKind.Password -> KeyboardType.Password
                    EditorialFieldKind.Uri -> KeyboardType.Uri
                    else -> KeyboardType.Text
                },
                capitalization = if (plain) KeyboardCapitalization.Sentences else KeyboardCapitalization.None,
                autoCorrectEnabled = plain,
                imeAction = if (kind == EditorialFieldKind.Search) ImeAction.Search else ImeAction.Default,
            ),
            visualTransformation = if (kind == EditorialFieldKind.Password) PasswordVisualTransformation() else VisualTransformation.None,
            modifier = Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused },
            decorationBox = { inner ->
                Box(
                    Modifier
                        .fillMaxWidth()
                        // iOS uses 44pt; 48dp is Android's minimum touch target
                        .height(48.dp)
                        .background(c.surfaceElevated)
                        .border(
                            EditorialMetrics.borderWidth,
                            when {
                                isError -> c.error
                                focused -> c.brand
                                else -> c.borderDefault
                            },
                        )
                        .padding(horizontal = 14.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (value.isEmpty()) Text(placeholder, style = type.sans(type.body.fontSize), color = c.textFaint, maxLines = 1)
                    inner()
                }
            },
        )

        if (footnote != null) Text(footnote, style = type.hint, color = if (isError) c.error else c.textFaint)
    }
}
