import { canRefresh, ensureFreshToken, refreshSession } from "@/lib/auth-refresh"
import { clearSession, previewReturnPath, restoreAdminSession } from "@/lib/session"
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
  User,
} from "@/lib/types"
import { BATCH_RETRIES, planBatches } from "@/lib/upload-batches"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://aura-api.reactiveshots.com/api"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  const match = document.cookie.match(/(?:^|; )token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

// sends an authed request; on a 401 it refreshes the session once and retries.
// Returns the response for the caller to read, or ends the session and throws.
async function authedFetch(url: string, build: (token: string | null) => RequestInit): Promise<Response> {
  await ensureFreshToken()
  let token = getToken()
  let res = await fetch(url, build(token))

  if (res.status === 401 && canRefresh()) {
    // a sibling request may have refreshed already; then the new token is enough
    const refreshed = getToken() !== token ? "ok" : await refreshSession()
    if (refreshed === "ok") {
      token = getToken()
      res = await fetch(url, build(token))
    } else if (refreshed === "unavailable") {
      throw new ApiError("Couldn't refresh your session. Check your connection.", 401)
    }
  }

  if (res.status === 401) {
    // an expired preview token puts the admin back where they were
    if (restoreAdminSession()) {
      window.location.href = previewReturnPath()
    } else {
      clearSession()
      window.location.href = "/login"
    }
    throw new Error("Unauthorized")
  }
  return res
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await authedFetch(`${API_URL}${path}`, (token) => {
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

    return {
      ...options,
      headers,
      // always hit the live API — face groupings change after a recluster, so a
      // cached /faces would show stale people/photos
      cache: "no-store",
    }
  })

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
  const res = await authedFetch(`${API_URL}${path}`, (token) => ({
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  }))
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
  const res = await authedFetch(`${API_URL}${path}`, (token) => ({
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }))

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
  // an existing album is targeted by slug so a rename can't split it in two
  albumSlug?: string
  albumName?: string
  userId: number
  faceDetection?: boolean
}

export type UploadStage = {
  stage: "uploading" | "saving" | "faces" | "clustering" | "warming" | "done"
  pct?: number // for "uploading" (network, across every batch)
  current?: number // for server stages
  total?: number
  batch?: number // 1-based batch being sent, when the upload is split
  batches?: number
  attempt?: number // 2 or 3 while a failed batch is retried
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

/** A batch failed for good; `uploaded` of `total` files were already saved. */
export class UploadBatchError extends Error {
  uploaded: number
  total: number
  constructor(message: string, uploaded: number, total: number) {
    super(message)
    this.uploaded = uploaded
    this.total = total
  }
}

class RequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// a 4xx other than timeout / rate limit won't change on a second try
const retryable = (e: unknown) =>
  !(e instanceof RequestError) ||
  e.status === 0 ||
  e.status >= 500 ||
  e.status === 408 ||
  e.status === 429

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Upload photos to a new or existing album.
 *
 * Files go up in batches (see upload-batches.ts), one request at a time, so no
 * single request outgrows the proxy limits. The batches share an upload
 * session; the last one is marked final and the server then runs faces and
 * warming once for the whole upload. A failed batch is retried twice. The
 * promise resolves when the last batch is saved; processing continues
 * server-side and is tracked on the processing page.
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
    const batches = planBatches(opts.files)
    const split = batches.length > 1

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
        // per-file server events would fight the overall batch progress
        if (d.stage && !split) {
          onStage?.({ stage: d.stage, current: d.current, total: d.total })
        }
      } catch {}
    }

    const run = async () => {
      const sessionId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const totalBytes = opts.files.reduce((n, f) => n + f.size, 0)
      let slug = opts.albumSlug ?? ""
      let processing = false
      let sentBytes = 0
      let sentFiles = 0

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const batchBytes = batch.reduce((n, f) => n + f.size, 0)
        const last = i === batches.length - 1

        for (let attempt = 1; ; attempt++) {
          const form = new FormData()
          batch.forEach((f) => form.append("files", f))
          const params = new URLSearchParams({
            user_id: String(opts.userId),
            face_detection: String(!!opts.faceDetection),
          })
          // later batches target the album the first one created
          if (slug) params.set("slug", slug)
          else params.set("album_name", opts.albumName ?? "")
          if (split) {
            params.set("session", sessionId)
            params.set("final", String(last))
          }

          const report = (frac: number) => {
            const overall = totalBytes
              ? (sentBytes + batchBytes * frac) / totalBytes
              : (sentFiles + batch.length * frac) / opts.files.length
            onStage?.({
              stage: "uploading",
              pct: Math.min(100, Math.round(overall * 100)),
              batch: i + 1,
              batches: batches.length,
              attempt: attempt > 1 ? attempt : undefined,
            })
          }
          report(0)

          try {
            const body = await postWithProgress<{
              album_slug?: string
              processing?: boolean
            }>(`/upload-files/?${params.toString()}`, form, (pct) =>
              report(pct / 100)
            )
            slug = body.album_slug ?? slug
            processing = !!body.processing
            break
          } catch (e) {
            if (attempt > BATCH_RETRIES || !retryable(e)) {
              const why = e instanceof Error ? e.message : "Upload failed"
              throw new UploadBatchError(
                `Upload stopped: ${sentFiles} of ${opts.files.length} files made it. ` +
                  `Batch ${i + 1} of ${batches.length} failed after ${attempt} ${attempt === 1 ? "try" : "tries"}: ${why}.`,
                sentFiles,
                opts.files.length
              )
            }
            await sleep(1000 * attempt)
          }
        }
        sentBytes += batchBytes
        sentFiles += batch.length
      }
      return { albumSlug: slug, processing }
    }

    const doUpload = () => {
      if (started) return
      started = true
      run()
        .then((result) => finish(undefined, result))
        .catch((e: Error) => finish(e))
    }

    // start once the ws is open so we don't miss stage events; if the ws can't
    // connect, upload anyway (just without the server-side stage updates).
    ws.onopen = doUpload
    ws.onerror = () => doUpload()
  })
}

// fetch can't report upload progress, so multipart posts go through xhr.
// A long upload can outlive the access token, so a 401 refreshes and retries once.
async function postWithProgress<T>(
  path: string,
  form: FormData,
  onProgress?: (pct: number) => void,
): Promise<T> {
  await ensureFreshToken()
  try {
    return await sendWithProgress<T>(path, form, onProgress)
  } catch (e) {
    if (e instanceof RequestError && e.status === 401 && canRefresh() && (await refreshSession()) === "ok") {
      return sendWithProgress<T>(path, form, onProgress)
    }
    throw e
  }
}

function sendWithProgress<T>(
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
        reject(
          new RequestError(
            typeof detail === "string" ? detail : "Upload failed",
            xhr.status
          )
        )
      }
    }
    xhr.onerror = () => reject(new RequestError("Upload failed", 0))
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

export type PreviewSession = {
  access_token: string
  expires_in: number
  user: User
}

export function startPreviewRequest(userId: number) {
  return apiFetch<PreviewSession>(`/admin/preview/${userId}`, { method: "POST" })
}

export function getPreviewOriginals(slug: string) {
  return apiFetch<{ originals: Record<string, string> }>(`/album/${slug}/preview-originals`)
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
  revise: (number: string, note?: string) =>
    post<Booking & { email_sent: boolean }>(`/bookings/${number}/revise`, { note }),
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
