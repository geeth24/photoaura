const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://aura-api.reactiveshots.com/api"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  const match = document.cookie.match(/(?:^|; )token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  // don't set content-type for FormData
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    document.cookie = "token=; path=/; max-age=0"
    document.cookie = "user=; path=/; max-age=0"
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || "Request failed")
  }

  return res.json()
}

export async function apiStream(
  path: string,
  onLine: (data: Record<string, unknown>) => void
) {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })

  const reader = res.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""
    for (const line of lines) {
      if (line.trim()) {
        try {
          onLine(JSON.parse(line))
        } catch {}
      }
    }
  }
}

export type UploadOptions = {
  files: File[]
  albumName: string
  userId: number
  faceDetection?: boolean
}

/**
 * Upload photos to a new or existing album. The backend streams byte progress
 * over a websocket, so we open one for the duration of the upload.
 */
export function uploadAlbum(
  opts: UploadOptions,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const wsUrl = API_URL.replace(/^http/, "ws") + "/ws/"
    const ws = new WebSocket(wsUrl)
    let settled = false

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      try {
        ws.close()
      } catch {}
      err ? reject(err) : resolve()
    }

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.total_bytes && onProgress) {
          onProgress(Math.min(99, Math.round((d.uploaded_bytes / d.total_bytes) * 100)))
        }
      } catch {}
    }

    ws.onerror = () => finish(new Error("Could not connect for upload progress"))

    ws.onopen = async () => {
      const form = new FormData()
      opts.files.forEach((f) => form.append("files", f))
      const params = new URLSearchParams({
        album_name: opts.albumName,
        user_id: String(opts.userId),
        face_detection: String(!!opts.faceDetection),
      })
      try {
        const res = await fetch(`${API_URL}/upload-files/?${params.toString()}`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        })
        if (!res.ok) {
          const error = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(error.detail || "Upload failed")
        }
        onProgress?.(100)
        finish()
      } catch (err) {
        finish(err instanceof Error ? err : new Error("Upload failed"))
      }
    }
  })
}

export function deletePhoto(slug: string, photoName: string): Promise<unknown> {
  const params = new URLSearchParams({ slug, photo_name: photoName })
  return apiFetch(`/photo/delete/?${params.toString()}`, { method: "DELETE" })
}
