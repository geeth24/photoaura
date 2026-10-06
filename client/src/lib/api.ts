import type {
  AppConfig,
  AppPlatform,
  AppVersionPolicy,
  Booking,
  BookingInput,
  BookingPackage,
  BookingPreview,
  BookingSummary,
  MyBookingSummary,
  MyInvoice,
  PaymentMethod,
  PhotoVersion,
  Revision,
  RevisionPreview,
  RevisionWithFiles,
} from "@/lib/types"

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
    throw new ApiError(typeof error.detail === "string" ? error.detail : "Request failed", res.status)
  }

  return res.json()
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// authed file download (e.g. a contract PDF) — a plain link can't carry the bearer token
export async function apiBlob(path: string): Promise<Blob> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(typeof error.detail === "string" ? error.detail : "Download failed", res.status)
  }
  return res.blob()
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
  stage: "uploading" | "saving" | "faces" | "clustering" | "warming" | "done"
  pct?: number // for "uploading" (network)
  current?: number // for server stages
  total?: number
}

export type UploadResult = {
  albumSlug: string
  processing: boolean
}

export type UploadStatus = {
  album_slug: string
  active: boolean
  finished: boolean
  phase: "saving" | "faces" | "clustering" | "warming" | "transcoding" | "proofing" | "unlocking" | "done"
  current: number
  total: number
  error: string | null
  face_detection: boolean
  image_count?: number
  kind?: "upload" | "resync" | "lock" | "unlock"
}

/** Poll background album processing (faces, clustering, cdn warming). */
export function getUploadStatus(slug: string): Promise<UploadStatus> {
  return apiFetch<UploadStatus>(`/upload-status/${slug}`)
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
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const wsUrl =API_URL.replace(/^http/, "ws") + "/ws/"
    const ws = new WebSocket(wsUrl)
    let settled = false
    let started = false

    const finish = (err?: Error, result?: UploadResult) => {
      if (settled) return
      settled = true
      try {
        ws.close()
      } catch {}
      err ? reject(err) : resolve(result ?? { albumSlug: "", processing: false })
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

      // server returns once files are saved; faces/warming run in the
      // background and are tracked on the processing page.
      postWithProgress<{ album_slug?: string; processing?: boolean }>(
        `/upload-files/?${params.toString()}`,
        form,
        (pct) => onStage?.({ stage: "uploading", pct }),
      )
        .then((body) =>
          finish(undefined, {
            albumSlug: body.album_slug ?? "",
            processing: !!body.processing,
          }),
        )
        .catch((e: Error) => finish(e))
    }

    // start once the ws is open so we don't miss stage events; if the ws can't
    // connect, upload anyway (just without the server-side stage updates).
    ws.onopen = doUpload
    ws.onerror = () => doUpload()
  })
}

// fetch can't report upload progress, so multipart posts go through xhr
function postWithProgress<T>(
  path: string,
  form: FormData,
  onProgress?: (pct: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${API_URL}${path}`)
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress?.(Math.round((ev.loaded / ev.total) * 100))
    }
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((body ?? {}) as T)
      } else {
        const detail = (body as { detail?: unknown } | null)?.detail
        reject(new Error(typeof detail === "string" ? detail : "Upload failed"))
      }
    }
    xhr.onerror = () => reject(new Error("Upload failed"))
    xhr.send(form)
  })
}

export function deletePhoto(slug: string, photoName: string): Promise<unknown> {
  const params = new URLSearchParams({ slug, photo_name: photoName })
  return apiFetch(`/photo/delete/?${params.toString()}`, { method: "DELETE" })
}

export function previewRevision(slug: string, filenames: string[]) {
  return apiFetch<RevisionPreview>(`/album/${slug}/revisions/preview`, {
    method: "POST",
    body: JSON.stringify({ filenames }),
  })
}

export type RevisionUploadResult = {
  revision: Revision
  updated: { uploaded: string; filename: string; version: number }[]
  added: string[]
  unmatched: string[]
  duplicates: string[]
  processing: boolean
}

/** Push re-edited photos as the album's next revision. */
export function uploadRevision(
  slug: string,
  opts: { files: File[]; note?: string; notify: boolean; addUnmatched: boolean },
  onProgress?: (pct: number) => void,
) {
  const form = new FormData()
  opts.files.forEach((f) => form.append("files", f))
  if (opts.note?.trim()) form.append("note", opts.note.trim())
  form.append("notify", String(opts.notify))
  form.append("add_unmatched", String(opts.addUnmatched))
  return postWithProgress<RevisionUploadResult>(`/album/${slug}/revisions`, form, onProgress)
}

export function listRevisions(slug: string) {
  return apiFetch<RevisionWithFiles[]>(`/album/${slug}/revisions`)
}

export function resendRevisionEmail(slug: string, number: number) {
  return apiFetch<{ message: string; to: string[] }>(
    `/album/${slug}/revisions/${number}/notify`,
    { method: "POST" },
  )
}

export function getPhotoVersions(photoId: number) {
  return apiFetch<PhotoVersion[]>(`/photo/${photoId}/versions`)
}

export function getAppConfig() {
  return apiFetch<AppConfig>("/app-config")
}

export function saveAppConfig(
  platform: AppPlatform,
  body: Pick<AppVersionPolicy, "min_version" | "latest_version" | "store_url" | "message">,
) {
  return apiFetch<Partial<AppConfig>>(`/admin/app-config/${platform}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })

export const bookingsApi = {
  packages: () => apiFetch<BookingPackage[]>("/booking-packages"),
  list: (status?: string) =>
    apiFetch<BookingSummary[]>(`/bookings${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  get: (number: string) => apiFetch<Booking>(`/bookings/${number}`),
  // `number` renders an existing booking with these edits on top
  preview: (body: Partial<BookingInput> & { number?: string }) => post<BookingPreview>("/bookings/preview", body),
  create: (body: BookingInput) => post<Booking>("/bookings", body),
  update: (number: string, body: Partial<BookingInput>) =>
    apiFetch<Booking>(`/bookings/${number}`, { method: "PATCH", body: JSON.stringify(body) }),
  send: (number: string) => post<Booking & { email_sent: boolean }>(`/bookings/${number}/send`),
  receive: (
    number: string,
    paymentId: number,
    body: { amount_cents: number; method: PaymentMethod; received_at?: string; note?: string },
  ) => post<Booking>(`/bookings/${number}/payments/${paymentId}/receive`, body),
  undo: (number: string, paymentId: number) =>
    post<Booking>(`/bookings/${number}/payments/${paymentId}/undo`),
  addCharge: (number: string, body: { label: string; amount_cents: number }) =>
    post<Booking>(`/bookings/${number}/payments`, body),
  removeCharge: (number: string, paymentId: number) =>
    apiFetch<Booking>(`/bookings/${number}/payments/${paymentId}`, { method: "DELETE" }),
  // processing = proofs (or full-res files) are being made in the background
  linkAlbum: (number: string, body: { album_id: number } | { create: true }) =>
    post<Booking & { processing: boolean }>(`/bookings/${number}/album`, body),
  delivered: (number: string) => post<Booking>(`/bookings/${number}/delivered`),
  unlock: (number: string, notify: boolean) =>
    post<Booking & { processing: boolean }>(`/bookings/${number}/unlock`, { notify }),
  cancel: (number: string, reason: string) => post<Booking>(`/bookings/${number}/cancel`, { reason }),
  contractPdf: (number: string, preview = false) =>
    apiBlob(`/bookings/${number}/contract.pdf${preview ? "?preview=1" : ""}`),
  // the studio's copy and the client's copy are the same PDF behind different auth
  invoicePdf: (number: string, mine: boolean) =>
    apiBlob(mine ? `/me/bookings/${number}/invoice.pdf` : `/bookings/${number}/invoice.pdf`),
  mine: () => apiFetch<MyBookingSummary[]>("/me/bookings"),
  mineOne: (number: string) => apiFetch<Booking>(`/me/bookings/${number}`),
  myInvoices: () => apiFetch<MyInvoice[]>("/me/invoices"),
  sign: (number: string, body: { full_name: string; consent: true; contract_hash: string }) =>
    post<Booking>(`/me/bookings/${number}/sign`, body),
}
