package com.radsoftinc.photoaura.features.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.photoaura.R
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.AuthResponse
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import com.radsoftinc.photoaura.ui.AuraField
import com.radsoftinc.photoaura.ui.BrandButton
import com.radsoftinc.photoaura.ui.Eyebrow
import com.radsoftinc.photoaura.ui.SecondaryButton
import com.radsoftinc.photoaura.ui.Type
import com.radsoftinc.photoaura.ui.aura

enum class LoginMode { Magic, Password }

data class LoginState(
    val mode: LoginMode = LoginMode.Magic,
    val email: String = "",
    val username: String = "",
    val password: String = "",
    val sending: Boolean = false,
    val sentTo: String? = null,
    val error: String? = null,
)

sealed interface LoginIntent {
    data class EmailChanged(val v: String) : LoginIntent
    data class UsernameChanged(val v: String) : LoginIntent
    data class PasswordChanged(val v: String) : LoginIntent
    data class ModeChanged(val m: LoginMode) : LoginIntent
    data object Submit : LoginIntent
    data object StartOver : LoginIntent
    data class LinkSent(val to: String) : LoginIntent
    data class SignedIn(val auth: AuthResponse) : LoginIntent
    data class Failed(val message: String) : LoginIntent
}

class LoginStore : Store<LoginState, LoginIntent>(LoginState()) {
    override fun send(intent: LoginIntent) {
        when (intent) {
            is LoginIntent.EmailChanged -> setState { copy(email = intent.v, error = null) }
            is LoginIntent.UsernameChanged -> setState { copy(username = intent.v, error = null) }
            is LoginIntent.PasswordChanged -> setState { copy(password = intent.v, error = null) }
            is LoginIntent.ModeChanged -> setState { copy(mode = intent.m, error = null) }
            LoginIntent.StartOver -> setState { copy(sentTo = null, email = "") }
            LoginIntent.Submit -> {
                val s = current
                if (s.sending) return
                setState { copy(sending = true, error = null) }
                io {
                    try {
                        if (s.mode == LoginMode.Magic) {
                            val email = s.email.trim()
                            Api.requestMagicLink(email)
                            send(LoginIntent.LinkSent(email))
                        } else {
                            send(LoginIntent.SignedIn(Api.passwordLogin(s.username.trim(), s.password)))
                        }
                    } catch (e: Exception) {
                        send(LoginIntent.Failed(e.friendly()))
                    }
                }
            }
            is LoginIntent.LinkSent -> setState { copy(sending = false, sentTo = intent.to) }
            is LoginIntent.SignedIn -> {
                setState { copy(sending = false) }
                Session.signIn(intent.auth)
            }
            is LoginIntent.Failed -> setState { copy(sending = false, error = intent.message) }
        }
    }
}

@Composable
fun LoginScreen(store: LoginStore = viewModel()) {
    val s by store.state.collectAsStateWithLifecycle()
    Column(
        Modifier
            .fillMaxSize()
            .background(aura.background)
            .safeDrawingPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
    ) {
        // same brand header as iOS: the light/dark logo, not the launcher icon
        Column(
            Modifier.fillMaxWidth().padding(top = 48.dp, bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Image(painterResource(R.drawable.logo), "PhotoAura", Modifier.size(56.dp))
            Text("PHOTOAURA", style = Type.eyebrow(11, 0.27.em).copy(fontWeight = FontWeight.SemiBold), color = aura.brand)
        }
        Spacer(Modifier.height(32.dp))

        Eyebrow("PhotoAura")
        Spacer(Modifier.height(14.dp))
        val heading = when {
            s.sentTo != null -> "Check your inbox"
            s.mode == LoginMode.Magic -> "Sign in"
            else -> "Sign in with password"
        }
        Text(heading, style = Type.serif(40), color = aura.textPrimary)

        if (s.sentTo != null) {
            Spacer(Modifier.height(24.dp))
            Column(
                Modifier.fillMaxWidth().background(aura.surfaceElevated).border(1.dp, aura.borderSubtle).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Link sent", style = Type.serif(26), color = aura.textPrimary)
                Text(
                    "If we recognize ${s.sentTo}, a sign-in link is on its way. It expires in 30 minutes.",
                    style = Type.sans(15), color = aura.textSecondary,
                )
                SecondaryButton("Use a different email") { store.send(LoginIntent.StartOver) }
            }
            return@Column
        }

        Spacer(Modifier.height(10.dp))
        Text(
            if (s.mode == LoginMode.Magic)
                "Enter the email your photographer sent your gallery to. We'll send a one-tap sign-in link."
            else "Enter your username and password.",
            style = Type.sans(15), color = aura.textSecondary,
        )
        Spacer(Modifier.height(28.dp))

        if (s.mode == LoginMode.Magic) {
            AuraField(
                s.email, { store.send(LoginIntent.EmailChanged(it)) }, "Email", "you@example.com",
                keyboard = KeyboardType.Email, error = s.error,
            )
            Spacer(Modifier.height(16.dp))
            BrandButton("Email me a sign-in link", loading = s.sending, enabled = s.email.isNotBlank()) {
                store.send(LoginIntent.Submit)
            }
        } else {
            AuraField(s.username, { store.send(LoginIntent.UsernameChanged(it)) }, "Username", "username")
            Spacer(Modifier.height(16.dp))
            AuraField(
                s.password, { store.send(LoginIntent.PasswordChanged(it)) }, "Password", "•••••••",
                keyboard = KeyboardType.Password, password = true, error = s.error,
            )
            Spacer(Modifier.height(16.dp))
            BrandButton("Sign in", loading = s.sending, enabled = s.username.isNotBlank() && s.password.isNotEmpty()) {
                store.send(LoginIntent.Submit)
            }
        }

        Spacer(Modifier.height(28.dp))
        Text(
            (if (s.mode == LoginMode.Magic) "Sign in with password" else "Use a magic link instead").uppercase(),
            style = Type.eyebrow(11, 0.16.em),
            color = aura.textMuted,
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .clickable {
                    store.send(LoginIntent.ModeChanged(if (s.mode == LoginMode.Magic) LoginMode.Password else LoginMode.Magic))
                }
                .padding(8.dp),
        )
        Spacer(Modifier.height(40.dp))
    }
}
