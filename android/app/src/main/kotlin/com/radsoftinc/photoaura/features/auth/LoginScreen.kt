package com.radsoftinc.photoaura.features.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.editorialstyle.EditorialBrandHeader
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialButtonStyle
import com.radsoftinc.editorialstyle.EditorialCard
import com.radsoftinc.editorialstyle.EditorialFieldKind
import com.radsoftinc.editorialstyle.EditorialSectionHeader
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTextField
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.AuthResponse
import com.radsoftinc.photoaura.core.Session
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.Studios
import com.radsoftinc.photoaura.core.friendly

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
    var picking by remember { mutableStateOf(false) }
    val c = EditorialTheme.colors
    // an error from the previous studio doesn't apply to the new one
    LaunchedEffect(Studios.selectedId) { store.send(LoginIntent.ModeChanged(s.mode)) }
    if (picking) StudioPickerSheet { picking = false }

    Column(
        Modifier
            .fillMaxSize()
            .background(c.background)
            .safeDrawingPadding()
            .imePadding()
            .verticalScroll(rememberScrollState()),
    ) {
        EditorialBrandHeader(Modifier.padding(top = EditorialSpacing.xLarge), logoSize = 56.dp)

        Column(
            Modifier
                .padding(horizontal = EditorialSpacing.screenGutter)
                .padding(top = EditorialSpacing.xxLarge, bottom = EditorialSpacing.xxxLarge),
            verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xLarge),
        ) {
            EditorialSectionHeader(
                title = when {
                    s.sentTo != null -> "Check your inbox"
                    s.mode == LoginMode.Magic -> "Sign in"
                    else -> "Sign in with password"
                },
                eyebrow = "PhotoAura",
                subtitle = when {
                    s.sentTo != null -> null
                    s.mode == LoginMode.Magic -> "Enter the email your photographer sent your gallery to. We'll send a one-tap sign-in link."
                    else -> "Enter your username and password."
                },
            )

            if (s.sentTo != null) {
                EditorialCard {
                    Text("Link sent", style = EditorialTheme.typography.heading, color = c.textPrimary)
                    Text(
                        "If we recognize ${s.sentTo}, a sign-in link is on its way. It expires in 30 minutes.",
                        style = EditorialTheme.typography.subtitle, color = c.textSecondary,
                    )
                    EditorialButton(
                        "Use a different email",
                        { store.send(LoginIntent.StartOver) },
                        Modifier.padding(top = EditorialSpacing.small),
                        style = EditorialButtonStyle.Secondary,
                    )
                }
                return@Column
            }

            StudioField { picking = true }

            Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
                if (s.mode == LoginMode.Magic) {
                    EditorialTextField(
                        s.email, { store.send(LoginIntent.EmailChanged(it)) }, "you@example.com",
                        label = "Email", kind = EditorialFieldKind.Email,
                        footnote = s.error, isError = s.error != null,
                    )
                    EditorialButton(
                        "Email me a sign-in link", { store.send(LoginIntent.Submit) },
                        isLoading = s.sending, isDisabled = s.email.isBlank(),
                    )
                } else {
                    EditorialTextField(s.username, { store.send(LoginIntent.UsernameChanged(it)) }, "username", label = "Username")
                    EditorialTextField(
                        s.password, { store.send(LoginIntent.PasswordChanged(it)) }, "•••••••",
                        label = "Password", kind = EditorialFieldKind.Password,
                        footnote = s.error, isError = s.error != null,
                    )
                    EditorialButton(
                        "Sign in", { store.send(LoginIntent.Submit) },
                        isLoading = s.sending, isDisabled = s.username.isBlank() || s.password.isEmpty(),
                    )
                }
            }

            Text(
                (if (s.mode == LoginMode.Magic) "Sign in with password" else "Use a magic link instead").uppercase(),
                style = EditorialTheme.typography.label(11.sp, 1.6.sp),
                color = c.textMuted,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(top = EditorialSpacing.small)
                    .clickable {
                        store.send(LoginIntent.ModeChanged(if (s.mode == LoginMode.Magic) LoginMode.Password else LoginMode.Magic))
                    }
                    .padding(8.dp),
            )
        }
    }
}
