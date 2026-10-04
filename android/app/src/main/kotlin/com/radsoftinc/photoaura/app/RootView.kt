package com.radsoftinc.photoaura.app

import android.net.Uri
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Collections
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.features.auth.LoginScreen
import com.radsoftinc.photoaura.features.gallery.AlbumScreen
import com.radsoftinc.photoaura.features.gallery.PhotoViewer
import com.radsoftinc.photoaura.features.gallery.ViewerHost
import com.radsoftinc.photoaura.features.home.HomeScreen
import com.radsoftinc.photoaura.features.library.AllPhotosScreen
import com.radsoftinc.photoaura.features.library.GalleriesScreen
import com.radsoftinc.photoaura.features.profile.ProfileScreen
import com.radsoftinc.photoaura.features.update.UpdatePrompts

/** Sign-in link waiting to be verified, from a tapped email or the aura:// scheme. */
object PendingLink {
    var token by mutableStateOf<String?>(null)

    fun from(uri: Uri?) {
        uri ?: return
        val verify = (uri.scheme == "https" && uri.host == "aura.reactiveshots.com" && uri.path?.startsWith("/auth/verify") == true) ||
            (uri.scheme == "aura" && uri.host == "verify")
        if (verify) uri.getQueryParameter("token")?.let { token = it }
    }
}

@Composable
fun RootView() {
    val viewer = remember { ViewerHost() }
    var linkError by remember { mutableStateOf<String?>(null) }

    // a tapped sign-in link wins over whatever session is on the device
    LaunchedEffect(PendingLink.token) {
        val t = PendingLink.token ?: return@LaunchedEffect
        PendingLink.token = null
        runCatching { Api.verifyMagicLink(t) }
            .onSuccess { Session.signIn(it); linkError = null }
            .onFailure { linkError = it.friendly() }
    }

    Box(Modifier.fillMaxSize().background(EditorialTheme.colors.background)) {
        val state = when {
            !Session.ready -> 0
            Session.user == null -> 1
            else -> 2
        }
        AnimatedContent(state, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "root") { s ->
            when (s) {
                0 -> Splash()
                1 -> LoginScreen()
                else -> MainTabs(viewer)
            }
        }
        viewer.request?.let { r ->
            PhotoViewer(r) { viewer.close() }
        }
        linkError?.let {
            LaunchedEffect(it) {
                kotlinx.coroutines.delay(4000); linkError = null
            }
        }
        UpdatePrompts()
    }
}

@Composable
private fun Splash() {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center) {
        CircularProgressIndicator(Modifier.size(24.dp), color = EditorialTheme.colors.brand, strokeWidth = 2.dp)
        Spacer(Modifier.height(16.dp))
        Text("PHOTOAURA", style = EditorialTheme.typography.brandMark, color = EditorialTheme.colors.textSecondary)
    }
}

private enum class Tab(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Outlined.Home),
    Photos("All Photos", Icons.Outlined.PhotoLibrary),
    Profile("Profile", Icons.Outlined.AccountCircle),
}

@Composable
private fun MainTabs(viewer: ViewerHost) {
    val nav = rememberNavController()
    var tab by rememberSaveable { mutableStateOf(Tab.Home) }
    val bottomBar = 80.dp

    NavHost(nav, startDestination = "tabs", modifier = Modifier.fillMaxSize()) {
        composable("tabs") {
            Box(Modifier.fillMaxSize()) {
                val openAlbum = { slug: String, name: String, actions: Boolean ->
                    nav.navigate("album/${Uri.encode(slug)}?name=${Uri.encode(name)}&actions=$actions")
                }
                when (tab) {
                    Tab.Home -> if (Session.isClient) {
                        HomeScreen(openAlbum, bottomBar)
                    } else {
                        GalleriesScreen({ slug, name -> openAlbum(slug, name, false) }, bottomBar)
                    }
                    Tab.Photos -> AllPhotosScreen(viewer, bottomBar)
                    Tab.Profile -> ProfileScreen(bottomBar)
                }
                NavigationBar(
                    containerColor = EditorialTheme.colors.surfaceElevated.copy(alpha = 0.96f),
                    modifier = Modifier.align(Alignment.BottomCenter),
                ) {
                    Tab.entries.forEach { t ->
                        val label = if (t == Tab.Home && !Session.isClient) "Galleries" else t.label
                        val icon = if (t == Tab.Home && !Session.isClient) Icons.Outlined.Collections else t.icon
                        NavigationBarItem(
                            selected = tab == t,
                            onClick = { tab = t },
                            icon = { Icon(icon, label) },
                            label = { Text(label, style = EditorialTheme.typography.sans(12.sp)) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = EditorialTheme.colors.brand,
                                selectedTextColor = EditorialTheme.colors.brand,
                                indicatorColor = EditorialTheme.colors.brand.copy(alpha = 0.14f),
                                unselectedIconColor = EditorialTheme.colors.textMuted,
                                unselectedTextColor = EditorialTheme.colors.textMuted,
                            ),
                        )
                    }
                }
            }
        }
        composable(
            "album/{slug}?name={name}&actions={actions}",
            arguments = listOf(
                navArgument("slug") { type = NavType.StringType },
                navArgument("name") { type = NavType.StringType; defaultValue = "" },
                navArgument("actions") { type = NavType.BoolType; defaultValue = false },
            ),
        ) { entry ->
            val args = entry.arguments!!
            AlbumScreen(
                slug = args.getString("slug")!!,
                title = args.getString("name") ?: "",
                openActions = args.getBoolean("actions"),
                viewer = viewer,
                onBack = { nav.popBackStack() },
            )
        }
    }
}
