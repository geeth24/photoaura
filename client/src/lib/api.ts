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
    // always hit the live API — face groupings change after a recluster, so a
    // cached /faces would show stale people/photos
    cache: "no-store",
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

export type UploadStage = {
  stage: "uploading" | "saving" | "faces" | "warming" | "done"
  pct?: number // for "uploading" (network)
  current?: number // for server stages
  total?: number
}

/**
 * Upload photos to a new or existing album.
 *
 * Two live signals drive the dialog: XHR upload progress for the network
 * transfer ("uploading"), and websocket stage events from the server for the
 * post-upload work ("saving" -> "faces" -> "warming" -> "done"). The promise
 * resolves only once the server has finished everything (incl. cache warming).
 */
export function uploadAlbum(
  opts: UploadOptions,
  onStage?: (s: UploadStage) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const wsUrl = API_URL.replace(/^http/, "ws") + "/ws/"
    const ws = new WebSocket(wsUrl)
    let settled = false
    let started = false

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
        if (d.stage) {
          onStage?.({ stage: d.stage, current: d.current, total: d.total })
        }
      } catch {}
    }

    const doUpload = () => {
      if (started) return
      started = true

      const form = new FormData()
      opts.files.forEach((f) => form.append("files", f))
      const params = new URLSearchParams({
        album_name: opts.albumName,
        user_id: String(opts.userId),
        face_detection: String(!!opts.faceDetection),
      })

      const xhr = new XMLHttpRequest()
      xhr.open("POST", `${API_URL}/upload-files/?${params.toString()}`)
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          onStage?.({
            stage: "uploading",
            pct: Math.round((ev.loaded / ev.total) * 100),
          })
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          finish()
        } else {
          let msg = "Upload failed"
          try {
            msg = JSON.parse(xhr.responseText).detail || msg
          } catch {}
          finish(new Error(msg))
        }
      }
      xhr.onerror = () => finish(new Error("Upload failed"))
      xhr.send(form)
    }

    // start once the ws is open so we don't miss stage events; if the ws can't
    // connect, upload anyway (just without the server-side stage updates).
    ws.onopen = doUpload
    ws.onerror = () => doUpload()
  })
}
export function deletePhoto(slug: string, photoName: string): Promise<unknown> {
  const params = new URLSearchParams({ slug, photo_name: photoName })
  return apiFetch(`/photo/delete/?${params.toString()}`, { method: "DELETE" })
}
