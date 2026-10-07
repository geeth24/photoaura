package com.radsoftinc.photoaura.features.bookings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTheme

sealed interface ContractBlock {
    data class Title(val text: String) : ContractBlock
    data class Heading(val text: String) : ContractBlock
    data class Para(val lines: List<String>) : ContractBlock
    data class Bullets(val items: List<Pair<String, List<String>>>) : ContractBlock
}

/** The contract's markdown subset: `# ` title, `## ` headings, `- ` bullets, `  - ` sub-bullets, `**bold**`. */
fun parseContract(md: String): List<ContractBlock> {
    val blocks = mutableListOf<ContractBlock>()
    var para: MutableList<String>? = null
    var list: MutableList<Pair<String, MutableList<String>>>? = null
    fun close() {
        para?.let { blocks += ContractBlock.Para(it) }
        list?.let { l -> blocks += ContractBlock.Bullets(l.map { it.first to it.second.toList() }) }
        para = null
        list = null
    }
    val sub = Regex("^\\s{2,}- ")
    for (raw in md.replace(Regex("<!--[\\s\\S]*?-->"), "").split("\n")) {
        val line = raw.trimEnd()
        val l = list
        when {
            line.isBlank() -> close()
            line.startsWith("# ") -> { close(); blocks += ContractBlock.Title(line.drop(2).trim()) }
            line.startsWith("## ") -> { close(); blocks += ContractBlock.Heading(line.drop(3).trim()) }
            sub.containsMatchIn(line) && l != null -> l.last().second += line.replace(Regex("^\\s+- "), "")
            line.startsWith("- ") -> {
                if (para != null) close()
                val target = list ?: mutableListOf<Pair<String, MutableList<String>>>().also { list = it }
                target += line.drop(2) to mutableListOf()
            }
            else -> {
                if (list != null) close()
                (para ?: mutableListOf<String>().also { para = it }) += line.trim()
            }
        }
    }
    close()
    return blocks
}

private fun bold(text: String, strong: Color): AnnotatedString = buildAnnotatedString {
    text.split("**").forEachIndexed { i, part ->
        if (i % 2 == 1) withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = strong)) { append(part) } else append(part)
    }
}

@Composable
fun ContractBlockView(block: ContractBlock) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val body = type.sans(15.sp).copy(lineHeight = 26.sp)
    when (block) {
        is ContractBlock.Title -> Column(Modifier.fillMaxWidth().padding(bottom = EditorialSpacing.large)) {
            Text(
                block.text,
                Modifier.fillMaxWidth().padding(bottom = EditorialSpacing.large),
                style = type.serif(26.sp).copy(lineHeight = 30.sp),
                color = c.textPrimary,
                textAlign = TextAlign.Center,
            )
            Box(Modifier.fillMaxWidth().height(1.dp).background(c.borderSubtle))
        }
        is ContractBlock.Heading -> Text(
            block.text,
            Modifier.padding(top = EditorialSpacing.xLarge, bottom = EditorialSpacing.small),
            style = type.serif(20.sp),
            color = c.textPrimary,
        )
        is ContractBlock.Para -> Text(
            bold(block.lines.joinToString("\n"), c.textPrimary),
            Modifier.padding(bottom = EditorialSpacing.small),
            style = body,
            color = c.textSecondary,
        )
        is ContractBlock.Bullets -> Column(Modifier.padding(bottom = EditorialSpacing.small), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            block.items.forEach { (text, children) ->
                Bullet(text, body)
                children.forEach { Bullet(it, body, Modifier.padding(start = EditorialSpacing.large)) }
            }
        }
    }
}

@Composable
private fun Bullet(text: String, style: androidx.compose.ui.text.TextStyle, modifier: Modifier = Modifier) {
    val c = EditorialTheme.colors
    Row(modifier, verticalAlignment = Alignment.Top) {
        Box(Modifier.padding(top = 11.dp, end = EditorialSpacing.small).size(4.dp).background(c.brand))
        Text(bold(text, c.textPrimary), style = style, color = c.textSecondary)
    }
}

/** The whole agreement in one column, for sheets that scroll it themselves. */
@Composable
fun ContractView(markdown: String, modifier: Modifier = Modifier) {
    val blocks = remember(markdown) { parseContract(markdown) }
    Column(modifier) { blocks.forEach { ContractBlockView(it) } }
}
