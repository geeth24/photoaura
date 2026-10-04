package com.radsoftinc.photoaura

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.radsoftinc.photoaura.app.PendingLink
import com.radsoftinc.photoaura.app.RootView
import com.radsoftinc.photoaura.core.AppUpdate
import com.radsoftinc.photoaura.core.SeenRevisions
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.Studios
import com.radsoftinc.photoaura.features.gallery.GridDensity
import com.radsoftinc.editorialstyle.EditorialTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        Studios.init(applicationContext) // before Session, which verifies against the studio's api
        Session.init(applicationContext)
        GridDensity.init(applicationContext)
        SeenRevisions.init(applicationContext)
        AppUpdate.init(applicationContext)
        PendingLink.from(intent?.data) // cold start from a tapped sign-in email
        setContent {
            EditorialTheme { RootView() }
        }
    }

    override fun onStart() {
        super.onStart()
        AppUpdate.check()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        PendingLink.from(intent.data) // tapped while already running
    }
}
