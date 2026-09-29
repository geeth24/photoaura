package com.radsoftinc.photoaura.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import coil.compose.AsyncImage
import coil.request.ImageRequest

@Composable
fun Eyebrow(text: String, color: Color = aura.textMuted, line: Boolean = true) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (line) {
            Box(Modifier.width(40.dp).height(1.dp).background(aura.brand))
            Spacer(Modifier.width(14.dp))
        }
        Text(text.uppercase(), style = Type.eyebrow(), color = color)
    }
}

@Composable
fun BrandButton(
    text: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    loading: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier
            .fillMaxWidth()
            .alpha(if (enabled) 1f else 0.5f)
            .background(aura.brand)
            .clickable(enabled = enabled && !loading, onClick = onClick)
            .padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(16.dp), color = aura.background, strokeWidth = 2.dp)
        } else {
            icon?.let { Icon(it, null, Modifier.size(16.dp), tint = aura.background); Spacer(Modifier.width(10.dp)) }
            Text(text.uppercase(), style = Type.eyebrow(12, 0.18.em).copy(fontWeight = FontWeight.Bold), color = aura.background)
        }
    }
}

@Composable
fun SecondaryButton(text: String, modifier: Modifier = Modifier, icon: ImageVector? = null, onClick: () -> Unit) {
    Row(
        modifier
            .fillMaxWidth()
            .border(BorderStroke(1.dp, aura.borderDefault))
            .clickable(onClick = onClick)
            .padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let { Icon(it, null, Modifier.size(16.dp), tint = aura.textSecondary); Spacer(Modifier.width(10.dp)) }
        Text(text.uppercase(), style = Type.eyebrow(12, 0.18.em).copy(fontWeight = FontWeight.Bold), color = aura.textSecondary)
    }
}

@Composable
fun AuraField(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    placeholder: String,
    modifier: Modifier = Modifier,
    keyboard: KeyboardType = KeyboardType.Text,
    password: Boolean = false,
    error: String? = null,
) {
    var focused by remember { mutableStateOf(false) }
    Column(modifier.fillMaxWidth()) {
        Text(label.uppercase(), style = Type.eyebrow(10, 0.25.em), color = aura.textMuted)
        Spacer(Modifier.height(8.dp))
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = Type.sans(16).copy(color = aura.textPrimary),
            cursorBrush = SolidColor(aura.brand),
            keyboardOptions = KeyboardOptions(keyboardType = keyboard, autoCorrectEnabled = false),
            visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
            modifier = Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused },
            decorationBox = { inner ->
                Box(
                    Modifier
                        .fillMaxWidth()
                        .background(aura.surfaceElevated)
                        .border(1.dp, when { error != null -> aura.error; focused -> aura.brand; else -> aura.borderDefault })
                        .padding(horizontal = 14.dp, vertical = 16.dp),
                ) {
                    if (value.isEmpty()) Text(placeholder, style = Type.sans(16), color = aura.textFaint)
                    inner()
                }
            },
        )
        error?.let {
            Spacer(Modifier.height(6.dp))
            Text(it, style = Type.sans(12), color = aura.error)
        }
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, subtitle: String, action: String? = null, onAction: () -> Unit = {}) {
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, aura.borderDefault)
            .padding(vertical = 48.dp, horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, null, Modifier.size(28.dp), tint = aura.textFaint)
        Spacer(Modifier.height(16.dp))
        Text(title, style = Type.serif(22), color = aura.textPrimary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(subtitle, style = Type.sans(14), color = aura.textMuted, textAlign = TextAlign.Center)
        if (action != null) {
            Spacer(Modifier.height(20.dp))
            SecondaryButton(action, Modifier.width(200.dp), onClick = onAction)
        }
    }
}

@Composable
fun Skeleton(modifier: Modifier) {
    val t = rememberInfiniteTransition(label = "skeleton")
    val a by t.animateFloat(0.5f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "pulse")
    Box(modifier.alpha(a).background(aura.surfaceCard))
}

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

@Composable
fun Hairline(modifier: Modifier = Modifier, thickness: Dp = 1.dp) {
    Box(modifier.fillMaxWidth().height(thickness).background(aura.borderSubtle))
}
