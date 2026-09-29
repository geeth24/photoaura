package com.radsoftinc.photoaura

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.radsoftinc.photoaura.app.PendingLink
import com.radsoftinc.photoaura.app.RootView
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.features.gallery.GridDensity
import com.radsoftinc.photoaura.ui.AuraTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        Session.init(applicationContext)
        GridDensity.init(applicationContext)
        PendingLink.from(intent?.data) // cold start from a tapped sign-in email
        setContent {
            AuraTheme { RootView() }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        PendingLink.from(intent.data) // tapped while already running
    }
}
