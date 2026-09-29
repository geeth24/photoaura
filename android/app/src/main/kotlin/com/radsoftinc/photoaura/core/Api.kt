package com.radsoftinc.photoaura.core

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.http.parameters
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNamingStrategy
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject

class ApiException(val status: Int, override val message: String) : Exception(message)

/** Paths mirror server/routers — plural `albums` lists, singular `album` is one by slug. */
object Api {
    const val BASE = "https://aura-api.reactiveshots.com/api"
    const val WEB = "https://aura.reactiveshots.com"

    @OptIn(ExperimentalSerializationApi::class)
    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        namingStrategy = JsonNamingStrategy.SnakeCase
    }

    private val client = HttpClient(OkHttp) {
        install(ContentNegotiation) { json(json) }
        expectSuccess = false
    }

    @Volatile var token: String? = null
    /** fired on a 401 so a revoked session drops back to sign-in instead of failing forever */
    var onUnauthorized: () -> Unit = {}

    private fun HttpRequestBuilder.auth() {
        token?.let { header("Authorization", "Bearer $it") }
    }

    private suspend inline fun <reified T> HttpResponse.decode(): T {
        if (!status.isSuccess()) {
            if (status.value == 401) onUnauthorized()
            throw ApiException(status.value, humanError(status.value, bodyAsText()))
        }
        return body()
    }

    private suspend fun HttpResponse.check() {
        if (!status.isSuccess()) {
            if (status.value == 401) onUnauthorized()
            throw ApiException(status.value, humanError(status.value, bodyAsText()))
        }
    }

    // raw HTML or huge bodies never reach the UI; FastAPI's {"detail": "..."} does
    private fun humanError(code: Int, body: String): String {
        val t = body.trim()
        if (t.startsWith("<") || t.length > 200) return "Server returned $code. Please try again."
        return try {
            (Json.parseToJsonElement(t).jsonObject["detail"] as? JsonPrimitive)?.content
        } catch (e: Exception) {
            null
        } ?: if (t.isEmpty()) "Something went wrong ($code)." else t
    }

    // MARK: auth

    @Serializable private data class EmailBody(val email: String)
    @Serializable private data class TokenBody(val token: String)

    suspend fun requestMagicLink(email: String) =
        client.post("$BASE/auth/request-link") {
            contentType(ContentType.Application.Json); setBody(EmailBody(email))
        }.check()

    suspend fun verifyMagicLink(token: String): AuthResponse =
        client.post("$BASE/auth/verify-link") {
            contentType(ContentType.Application.Json); setBody(TokenBody(token))
        }.decode()

    // form-encoded, FastAPI's OAuth2PasswordRequestForm
    suspend fun passwordLogin(username: String, password: String): AuthResponse =
        client.submitForm(
            url = "$BASE/login",
            formParameters = parameters {
                append("username", username)
                append("password", password)
            },
        ).decode()

    suspend fun verifyToken() =
        client.post("$BASE/verify-token") { auth(); contentType(ContentType.Application.Json); setBody(JsonObject(emptyMap())) }.check()

    @Serializable private data class UpdateMe(val userName: String? = null, val fullName: String? = null)

    suspend fun updateMe(userName: String?, fullName: String?): CurrentUser =
        client.patch("$BASE/me") {
            auth(); contentType(ContentType.Application.Json); setBody(UpdateMe(userName, fullName))
        }.decode()

    suspend fun deleteAccount() = client.delete("$BASE/me") { auth() }.check()

    // MARK: galleries

    suspend fun home(): HomeSummary = client.get("$BASE/me/home") { auth() }.decode()

    suspend fun myAlbums(userId: Int): List<AlbumSummary> =
        client.get("$BASE/albums/") { auth(); parameter("user_id", userId) }.decode()

    suspend fun album(slug: String): AlbumDetail = client.get("$BASE/album/$slug/") { auth() }.decode()

    suspend fun albumFaces(slug: String): List<FaceSummary> =
        client.get("$BASE/album/$slug/faces") { auth() }.decode()

    suspend fun allPhotos(userId: Int, orientation: String?): List<Photo> =
        client.get("$BASE/photos/") {
            auth(); parameter("user_id", userId); orientation?.let { parameter("orientation", it) }
        }.decode()

    suspend fun favorites(slug: String): List<String> =
        client.get("$BASE/album/$slug/favorites") { auth() }.decode<FavoriteList>().filenames

    @Serializable private data class FavoriteBody(val filename: String, val favorite: Boolean)

    suspend fun setFavorite(slug: String, filename: String, favorite: Boolean) =
        client.post("$BASE/album/$slug/favorites") {
            auth(); contentType(ContentType.Application.Json); setBody(FavoriteBody(filename, favorite))
        }.check()

    suspend fun downloadTicket(slug: String): String =
        client.post("$BASE/album/$slug/download-ticket") {
            auth(); contentType(ContentType.Application.Json); setBody(JsonObject(emptyMap()))
        }.decode<DownloadTicket>().ticket

    fun zipUrl(slug: String, ticket: String) =
        "$BASE/album/$slug/download-all?ticket=${java.net.URLEncoder.encode(ticket, "UTF-8")}"

    fun shareUrl(slug: String, secret: String?) =
        "$WEB/share/$slug" + if (!secret.isNullOrEmpty()) "?s=$secret" else ""
}
