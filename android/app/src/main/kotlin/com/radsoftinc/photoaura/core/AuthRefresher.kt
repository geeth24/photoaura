package com.radsoftinc.photoaura.core

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpSend
import io.ktor.client.plugins.plugin
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import java.util.Base64

@Serializable
data class RefreshResponse(val accessToken: String, val refreshToken: String? = null, val user: CurrentUser? = null)

@Serializable
private data class RefreshBody(val refreshToken: String)

/**
 * Holds the access and refresh tokens and keeps the access token fresh.
 * Tokens come from the server that issued them, so refreshing always goes back to [base].
 */
class AuthRefresher(
    private val client: () -> HttpClient,
    private val json: Json,
    private val onRefreshed: (RefreshResponse, base: String?) -> Unit,
    private val onRejected: () -> Unit,
    private val now: () -> Long = System::currentTimeMillis,
) {
    @Volatile var access: String? = null
        private set
    @Volatile var refresh: String? = null
        private set
    @Volatile var base: String? = null
        private set

    private val mutex = Mutex()

    fun set(access: String?, refresh: String?, base: String?) {
        this.access = access
        this.refresh = refresh
        this.base = base
    }

    private enum class Outcome { Refreshed, Rejected, Failed }

    /** Refreshes once when [stale] is still the current token; later callers find a newer one and skip the call. */
    private suspend fun refreshLocked(stale: String?, onlyIfExpiring: Boolean): Outcome = mutex.withLock {
        val token = refresh ?: return Outcome.Failed
        if (access != stale) return Outcome.Refreshed
        if (onlyIfExpiring && !expiring(access)) return Outcome.Refreshed
        val root = base ?: return Outcome.Failed
        val response = try {
            client().post("$root/auth/refresh") {
                contentType(ContentType.Application.Json); setBody(RefreshBody(token))
            }
        } catch (e: Exception) {
            return Outcome.Failed
        }
        when {
            response.status == HttpStatusCode.Unauthorized -> {
                set(null, null, null)
                onRejected()
                Outcome.Rejected
            }
            !response.status.isSuccess() -> Outcome.Failed
            else -> try {
                val r = response.body<RefreshResponse>()
                access = r.accessToken
                r.refreshToken?.let { refresh = it }
                onRefreshed(r, root)
                Outcome.Refreshed
            } catch (e: Exception) {
                Outcome.Failed
            }
        }
    }

    /** No-op unless a refresh token is held and the access token is within the expiry window. */
    suspend fun refreshIfExpiring() {
        if (refresh != null) refreshLocked(access, onlyIfExpiring = true)
    }

    private fun HttpRequestBuilder.bearer(token: String?) {
        headers.remove(HttpHeaders.Authorization)
        token?.let { headers.append(HttpHeaders.Authorization, "Bearer $it") }
    }

    private fun expiring(token: String?): Boolean {
        val exp = expiry(token, json) ?: return false
        return exp * 1000 - now() < EXPIRY_WINDOW_MS
    }

    /** Wraps every authorized request: refresh early near expiry, and once more on a 401. */
    fun install(http: HttpClient, onUnauthorized: () -> Unit) {
        http.plugin(HttpSend).intercept { request ->
            if (!request.headers.contains(HttpHeaders.Authorization)) return@intercept execute(request)

            refreshIfExpiring()
            val sent = access
            request.bearer(sent)

            val call = execute(request)
            if (call.response.status != HttpStatusCode.Unauthorized) return@intercept call

            if (refresh == null) {
                onUnauthorized()
                return@intercept call
            }
            when (refreshLocked(sent, onlyIfExpiring = false)) {
                Outcome.Refreshed -> {
                    runCatching { call.response.bodyAsBytes() }
                    request.bearer(access)
                    val retried = execute(request)
                    if (retried.response.status == HttpStatusCode.Unauthorized) onUnauthorized()
                    retried
                }
                Outcome.Rejected, Outcome.Failed -> call
            }
        }
    }

    companion object {
        const val EXPIRY_WINDOW_MS = 5 * 60 * 1000L

        /** `exp` in seconds from a JWT access token, or null when the token isn't one. */
        fun expiry(token: String?, json: Json): Long? {
            val part = token?.split('.')?.getOrNull(1) ?: return null
            return try {
                val payload = String(Base64.getUrlDecoder().decode(part))
                json.parseToJsonElement(payload).jsonObject["exp"]?.jsonPrimitive?.long
            } catch (e: Exception) {
                null
            }
        }
    }
}
