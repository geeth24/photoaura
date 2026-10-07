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
    // follows the studio picked at sign-in
    val BASE: String get() = Studios.selected.apiUrl
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

    suspend fun photoVersions(photoId: Int): List<PhotoVersion> =
        client.get("$BASE/photo/$photoId/versions") { auth() }.decode()

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

    // MARK: bookings, client side

    suspend fun myBookings(): List<BookingSummary> = client.get("$BASE/me/bookings") { auth() }.decode()

    suspend fun myBooking(number: String): Booking = client.get("$BASE/me/bookings/${seg(number)}") { auth() }.decode()

    @Serializable private data class SignBody(val fullName: String, val consent: Boolean, val contractHash: String)

    /** 409 means the agreement changed since it was loaded (or it's already signed). */
    suspend fun signBooking(number: String, fullName: String, contractHash: String): Booking =
        client.post("$BASE/me/bookings/${seg(number)}/sign") {
            auth(); contentType(ContentType.Application.Json); setBody(SignBody(fullName, true, contractHash))
        }.decode()

    suspend fun myInvoices(): List<MyInvoice> = client.get("$BASE/me/invoices") { auth() }.decode()

    suspend fun myInvoicePdf(number: String): ByteArray = bytes("$BASE/me/bookings/${seg(number)}/invoice.pdf")

    // the same route serves the admin and the booking's own client
    suspend fun contractPdf(number: String, preview: Boolean = false): ByteArray =
        bytes("$BASE/bookings/${seg(number)}/contract.pdf" + if (preview) "?preview=true" else "")

    /** Dark map with a numbered pin per stop; needs the bearer token, so images load it with a header. */
    fun staticMapUrl(stops: List<String>, w: Int = 640, h: Int = 240): String {
        val q = stops.joinToString("&") { "stops=" + java.net.URLEncoder.encode(it, "UTF-8") }
        return "$BASE/maps/static.png?$q&w=$w&h=$h"
    }

    // MARK: bookings, studio side

    suspend fun bookings(): List<BookingSummary> = client.get("$BASE/bookings") { auth() }.decode()

    suspend fun booking(number: String): Booking = client.get("$BASE/bookings/${seg(number)}") { auth() }.decode()

    suspend fun sendBooking(number: String): Booking = postEmpty("$BASE/bookings/${seg(number)}/send")

    @Serializable private data class ReceiveBody(val amountCents: Long, val method: String, val receivedAt: String, val note: String?)

    /** receivedAt is a plain YYYY-MM-DD; the server reads today as now and earlier days as noon. */
    suspend fun receivePayment(number: String, paymentId: Int, amountCents: Long, method: String, receivedAt: String, note: String?): Booking =
        client.post("$BASE/bookings/${seg(number)}/payments/$paymentId/receive") {
            auth(); contentType(ContentType.Application.Json); setBody(ReceiveBody(amountCents, method, receivedAt, note))
        }.decode()

    suspend fun undoPayment(number: String, paymentId: Int): Booking =
        postEmpty("$BASE/bookings/${seg(number)}/payments/$paymentId/undo")

    @Serializable private data class ChargeBody(val label: String, val amountCents: Long)

    suspend fun addCharge(number: String, label: String, amountCents: Long): Booking =
        client.post("$BASE/bookings/${seg(number)}/payments") {
            auth(); contentType(ContentType.Application.Json); setBody(ChargeBody(label, amountCents))
        }.decode()

    suspend fun removeCharge(number: String, paymentId: Int): Booking =
        client.delete("$BASE/bookings/${seg(number)}/payments/$paymentId") { auth() }.decode()

    suspend fun markDelivered(number: String): Booking = postEmpty("$BASE/bookings/${seg(number)}/delivered")

    suspend fun invoicePdf(number: String): ByteArray = bytes("$BASE/bookings/${seg(number)}/invoice.pdf")

    private suspend fun postEmpty(url: String): Booking =
        client.post(url) { auth(); contentType(ContentType.Application.Json); setBody(JsonObject(emptyMap())) }.decode()

    private suspend fun bytes(url: String): ByteArray {
        val r = client.get(url) { auth() }
        r.check()
        return r.body()
    }

    private fun seg(s: String) = java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    // public and unauthenticated, so a failure here never signs anyone out
    suspend fun appConfig(): AppConfig {
        val r = client.get("$BASE/app-config")
        if (!r.status.isSuccess()) throw ApiException(r.status.value, "app-config ${r.status.value}")
        return r.body()
    }

    fun shareUrl(slug: String, secret: String?) =
        "$WEB/share/$slug" + if (!secret.isNullOrEmpty()) "?s=$secret" else ""
}
