package com.radsoftinc.photoaura.core

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import java.util.Base64
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AuthRefresherTest {
    private val json = Api.json
    private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")

    private class Rig(val client: HttpClient, val refresher: AuthRefresher) {
        val log = mutableListOf<HttpRequestData>()
        val refreshCalls = AtomicInteger()
        val rejected = AtomicInteger()
        val unauthorized = AtomicInteger()
        val saved = mutableListOf<RefreshResponse>()
    }

    private fun jwt(expSeconds: Long): String {
        val enc = Base64.getUrlEncoder().withoutPadding()
        val body = enc.encodeToString("""{"exp":$expSeconds}""".toByteArray())
        return "h.$body.s"
    }

    private fun rig(
        now: () -> Long = { 1_000_000_000_000L },
        handler: suspend MockRequestHandleScope.(HttpRequestData, Rig) -> HttpResponseData,
    ): Rig {
        lateinit var rig: Rig
        val engine = MockEngine { request ->
            rig.log += request
            handler(request, rig)
        }
        val client = HttpClient(engine) { install(ContentNegotiation) { json(json) } }
        val refresher = AuthRefresher(
            client = { client },
            json = json,
            onRefreshed = { r, _ -> rig.saved += r },
            onRejected = { rig.rejected.incrementAndGet() },
            now = now,
        )
        rig = Rig(client, refresher)
        refresher.install(client) { rig.unauthorized.incrementAndGet() }
        return rig
    }

    private fun Rig.bearer(r: HttpRequestData) = r.headers[HttpHeaders.Authorization]

    private suspend fun Rig.call(): HttpResponse =
        client.get("https://api.test/api/me") { header(HttpHeaders.Authorization, "Bearer ${refresher.access}") }

    private fun refreshOk(scope: MockRequestHandleScope, access: String, refresh: String) = scope.respond(
        """{"access_token":"$access","token_type":"bearer","refresh_token":"$refresh","refresh_expires_in":7776000,"user":{"id":1}}""",
        HttpStatusCode.OK, jsonHeaders,
    )

    @Test
    fun retriesOnceAfterA401() = runBlocking {
        val rig = rig { req, rig ->
            when {
                req.url.encodedPath.endsWith("/auth/refresh") -> {
                    rig.refreshCalls.incrementAndGet()
                    refreshOk(this, "new-access", "r2")
                }
                rig.bearer(req) == "Bearer new-access" -> respond("ok", HttpStatusCode.OK)
                else -> respond("", HttpStatusCode.Unauthorized)
            }
        }
        rig.refresher.set("old-access", "r1", "https://api.test/api")

        val response = rig.call()

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(1, rig.refreshCalls.get())
        assertEquals("new-access", rig.refresher.access)
        assertEquals("r2", rig.refresher.refresh)
        assertEquals(1, rig.saved.size)
        assertEquals(0, rig.unauthorized.get())
        assertEquals(3, rig.log.size)
    }

    @Test
    fun concurrent401sShareOneRefresh() = runBlocking {
        val rig = rig { req, rig ->
            when {
                req.url.encodedPath.endsWith("/auth/refresh") -> {
                    rig.refreshCalls.incrementAndGet()
                    delay(50)
                    refreshOk(this, "new-access", "r2")
                }
                rig.bearer(req) == "Bearer new-access" -> respond("ok", HttpStatusCode.OK)
                else -> respond("", HttpStatusCode.Unauthorized)
            }
        }
        rig.refresher.set("old-access", "r1", "https://api.test/api")

        val statuses = (1..5).map { async { rig.call().status } }.awaitAll()

        assertTrue(statuses.all { it == HttpStatusCode.OK })
        assertEquals(1, rig.refreshCalls.get())
    }

    @Test
    fun refreshSendsTheRefreshTokenToTheIssuingServer() = runBlocking {
        var body = ""
        var host = ""
        val rig = rig { req, rig ->
            when {
                req.url.encodedPath.endsWith("/auth/refresh") -> {
                    body = String(req.body.toByteArray())
                    host = req.url.host
                    assertNull(rig.bearer(req))
                    refreshOk(this, "new-access", "r2")
                }
                rig.bearer(req) == "Bearer new-access" -> respond("ok", HttpStatusCode.OK)
                else -> respond("", HttpStatusCode.Unauthorized)
            }
        }
        rig.refresher.set("old-access", "r1", "https://studio.test/api")

        rig.call()

        assertEquals("""{"refresh_token":"r1"}""", body)
        assertEquals("studio.test", host)
    }

    @Test
    fun rejectedRefreshSignsOut() = runBlocking {
        val rig = rig { req, rig ->
            if (req.url.encodedPath.endsWith("/auth/refresh")) rig.refreshCalls.incrementAndGet()
            respond("", HttpStatusCode.Unauthorized)
        }
        rig.refresher.set("old-access", "r1", "https://api.test/api")

        val response = rig.call()

        assertEquals(HttpStatusCode.Unauthorized, response.status)
        assertEquals(1, rig.refreshCalls.get())
        assertEquals(1, rig.rejected.get())
        assertNull(rig.refresher.refresh)
        assertNull(rig.refresher.access)
    }

    @Test
    fun transientRefreshFailureKeepsTheSession() = runBlocking {
        val rig = rig { req, _ ->
            if (req.url.encodedPath.endsWith("/auth/refresh")) respond("", HttpStatusCode.BadGateway)
            else respond("", HttpStatusCode.Unauthorized)
        }
        rig.refresher.set("old-access", "r1", "https://api.test/api")

        rig.call()

        assertEquals(0, rig.rejected.get())
        assertEquals(0, rig.unauthorized.get())
        assertEquals("r1", rig.refresher.refresh)
    }

    @Test
    fun noRefreshTokenBehavesAsBefore() = runBlocking {
        val rig = rig { _, _ -> respond("", HttpStatusCode.Unauthorized) }
        rig.refresher.set("old-access", null, "https://api.test/api")

        val response = rig.call()

        assertEquals(HttpStatusCode.Unauthorized, response.status)
        assertEquals(1, rig.log.size)
        assertEquals(1, rig.unauthorized.get())
    }

    @Test
    fun requestsWithoutAuthSkipRefresh() = runBlocking {
        val rig = rig { _, _ -> respond("", HttpStatusCode.Unauthorized) }
        rig.refresher.set("old-access", "r1", "https://api.test/api")

        val response = rig.client.get("https://api.test/api/login")

        assertEquals(HttpStatusCode.Unauthorized, response.status)
        assertEquals(1, rig.log.size)
        assertEquals(0, rig.unauthorized.get())
    }

    @Test
    fun refreshesAheadOfExpiry() = runBlocking {
        val nowMs = 1_000_000_000_000L
        val soon = jwt(nowMs / 1000 + 120)
        val rig = rig(now = { nowMs }) { req, rig ->
            if (req.url.encodedPath.endsWith("/auth/refresh")) {
                rig.refreshCalls.incrementAndGet()
                refreshOk(this, "fresh", "r2")
            } else respond("ok", HttpStatusCode.OK)
        }
        rig.refresher.set(soon, "r1", "https://api.test/api")

        rig.call()

        assertEquals(1, rig.refreshCalls.get())
        assertEquals("Bearer fresh", rig.bearer(rig.log.last()))
    }

    @Test
    fun leavesAFreshTokenAlone() = runBlocking {
        val nowMs = 1_000_000_000_000L
        val rig = rig(now = { nowMs }) { req, rig ->
            if (req.url.encodedPath.endsWith("/auth/refresh")) rig.refreshCalls.incrementAndGet()
            respond("ok", HttpStatusCode.OK)
        }
        rig.refresher.set(jwt(nowMs / 1000 + 3600), "r1", "https://api.test/api")

        rig.call()
        rig.refresher.refreshIfExpiring()

        assertEquals(0, rig.refreshCalls.get())
    }

    @Test
    fun expiryReadsTheJwtClaim() {
        assertEquals(1234L, AuthRefresher.expiry(jwt(1234), json))
        assertNull(AuthRefresher.expiry("opaque", json))
        assertNull(AuthRefresher.expiry(null, json))
    }
}
