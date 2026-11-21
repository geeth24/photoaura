from starlette.datastructures import Headers
from starlette.middleware.gzip import GZipMiddleware, GZipResponder
from starlette.types import Message, Receive, Scope, Send


class _JsonResponder(GZipResponder):
    async def send_with_gzip(self, message: Message) -> None:
        await super().send_with_gzip(message)
        if message["type"] == "http.response.start":
            ctype = Headers(raw=message["headers"]).get("content-type", "")
            if not ctype.startswith("application/json"):
                # zips, PDFs and images are already compressed; leave them alone
                self.content_encoding_set = True


class JsonGZipMiddleware(GZipMiddleware):
    """Gzips JSON responses only. Photo lists are mostly repeated keys and URLs,
    and the API sits behind a home uplink, so bytes on the wire are the cost."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and "gzip" in Headers(scope=scope).get("Accept-Encoding", ""):
            responder = _JsonResponder(self.app, self.minimum_size, compresslevel=self.compresslevel)
            await responder(scope, receive, send)
            return
        await self.app(scope, receive, send)
