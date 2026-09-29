package com.radsoftinc.editorialstyle

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** The PhotoAura logo; night resources swap in the light-on-dark version. */
@Composable
fun PhotoAuraLogo(modifier: Modifier = Modifier) {
    Image(painterResource(R.drawable.photoaura_logo), "PhotoAura", modifier)
}

@Composable
fun EditorialBrandHeader(
    modifier: Modifier = Modifier,
    label: String = "PhotoAura",
    logoSize: Dp = 44.dp,
    logo: @Composable () -> Unit = { PhotoAuraLogo(Modifier.fillMaxSize()) },
) {
    Column(
        modifier.fillMaxWidth().padding(vertical = EditorialSpacing.xLarge),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small),
    ) {
        Box(Modifier.size(logoSize), contentAlignment = Alignment.Center) { logo() }
        Text(label.uppercase(), style = EditorialTheme.typography.brandMark, color = EditorialTheme.colors.brand)
    }
}
