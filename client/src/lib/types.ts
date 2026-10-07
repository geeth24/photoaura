export type User = {
  id: number
  user_name: string
  full_name: string
  user_email: string
  role?: "admin" | "client"
  albums?: Album[]
  last_login_at?: string | null
  // set on a family member — they see whatever this account was granted
  parent_user_id?: number | null
  family?: FamilyMember[]
}

export type FamilyMember = Pick<
  User,
  "id" | "full_name" | "user_email" | "last_login_at" | "parent_user_id"
>

export type UserDetail = Omit<User, "albums"> & {
  parent?: FamilyMember | null
  emails?: { email: string; is_primary: boolean; verified: boolean }[]
  albums?: { id: number; name: string; slug: string; image_count: number }[]
  downloads?: { id: number; filename: string; size: number; album_id: number | null }[]
  videos?: { id: number; title: string | null; album_id: number | null }[]
}

export type NotifyKind =
  | "login_link"
  | "gallery_ready"
  | "new_download"
  | "new_video"

export type Album = {
  album_id?: number
  album_name: string
  slug: string
  image_count: number
  shared: boolean
  upload: boolean
  secret?: string
  public?: boolean
  face_detection?: boolean
  album_permissions?: AlbumPermission[]
  album_photos: Photo[]
  // latest re-edit pushed after delivery; the delivery itself is version 1
  revision?: Revision | null
  // proof mode: watermarked, downloads refused until the final payment
  locked?: boolean
  booking_number?: string | null
}

export type Revision = {
  number: number
  note: string | null
  photo_count: number
  created_at: string
  notified_at: string | null
}

export type RevisionWithFiles = Revision & { filenames: string[] }

export type PhotoVersion = {
  version: number
  filename: string
  revision_number: number | null
  uploaded_at: string | null
  width: number
  height: number
  image: string
  compressed_image: string
}

export type RevisionPreview = {
  next_number: number
  matched: {
    filename: string
    photo_id: number
    current_filename: string
    current_version: number
    next_version: number
  }[]
  unmatched: string[]
  duplicates: string[]
}

export type AppPlatform = "ios" | "android"

export type AppVersionPolicy = {
  min_version: string | null
  latest_version: string | null
  store_url: string | null
  message: string | null
  updated_at: string | null
}

export type AppConfig = Record<AppPlatform, AppVersionPolicy | null>

export type AlbumPermission = {
  user_id: number
  user_name: string
  full_name: string
  user_email: string
}

export type Photo = {
  image: string
  compressed_image: string
  file_metadata: FileMetadata
}

export const isVideo = (p: Photo) =>
  (p.file_metadata.content_type || "").startsWith("video/")

export type FileMetadata = {
  id?: number
  album_id: number
  filename: string
  content_type: string
  size: number
  width: number
  height: number
  upload_date: string
  exif_data: string | Record<string, unknown>
  blur_data_url: string
  orientation: "portrait" | "landscape" | "square" | null
  description: string | null
  tags: string[] | null
  version?: number
  revision_number?: number | null
}

export type DashboardStats = {
  albums: number
  users: number
  photos: number
}

export type LoginResponse = {
  message: string
  access_token: string
  token_type: string
  user: User
}

export type Category = {
  id: number
  name: string
  slug: string
}

export type CategoryAlbum = {
  category_id: number
  category_name: string
  category_slug: string
  album: Album
}

export type Face = {
  id: string
  name: string
  external_id: string
  image_url?: string
  face_photos?: Photo[]
}

export type AlbumFace = {
  face_id: string
  name: string | null
  image_url: string
  count: number
  filenames: string[]
}

export type BookingStatus =
  | "draft"
  | "sent"
  | "signed"
  | "booked"
  | "event_complete"
  | "delivered"
  | "paid"
  | "cancelled"

export type BookingPackage = {
  key: string
  category: string
  name: string
  pricing: "hourly" | "flat"
  rate_cents: number
  min_hours: number | null
  includes_video: boolean
  revisions: number
}

// the final payment and any extra charges come back as one "Final payment" line
export type NextPayment = {
  kind: BookingPayment["kind"]
  label: string
  amount_cents: number
  // due now, as opposed to upcoming
  due: boolean
} | null

export type BookingSummary = {
  number: string
  status: BookingStatus
  client: { user_id: number; full_name: string; email: string }
  event_type: string
  event_date: string
  package_name: string
  total_due_cents: number
  paid_cents: number
  next_payment: NextPayment
  album_slug: string | null
  created_at: string
}

export type MyBookingSummary = Omit<BookingSummary, "client" | "created_at"> & {
  action: "sign" | "pay" | null
  balance_cents: number
}

// open = something is still owed but nothing is due yet
export type InvoiceStatus = "due" | "open" | "paid" | "cancelled"

export type MyInvoice = {
  booking_number: string
  invoice_number: string
  event_type: string
  event_date: string
  issued_at: string
  total_cents: number
  paid_cents: number
  balance_cents: number
  status: InvoiceStatus
  next_payment: NextPayment
}

export type PaymentMethod = "zelle" | "cash" | "check" | "other"

export type BookingPayment = {
  id: number
  kind: "retainer" | "event_day" | "final" | "extra"
  label: string
  percent: number | null
  amount_cents: number
  state: "upcoming" | "due" | "paid"
  received_cents: number
  received_at: string | null
  method: PaymentMethod | null
  note: string | null
}

export type Booking = {
  number: string
  status: BookingStatus
  client: { user_id: number; full_name: string; email: string; phone: string | null }
  event: {
    type: string
    date: string
    start_time: string
    end_time: string
    location: string
  }
  package: {
    key: string
    name: string
    includes_video: boolean
    revisions: number
    hours: number | null
    hourly_rate_cents: number | null
    overtime_rate_cents: number
    fee_overridden: boolean
  }
  money: { total_fee: number; extras: number; total_due: number; paid: number; balance: number }
  payments: BookingPayment[]
  contract: {
    version: string | null
    hash: string | null
    sent_at: string | null
    signed: boolean
    signed_at: string | null
    signed_name: string | null
    signed_ip?: string | null
    pdf_url: string | null
    // the snapshot that was sent / signed; null on a draft
    markdown: string | null
  }
  album: { id?: number; slug: string; name: string; locked: boolean } | null
  details_for_client: string | null
  notes_internal?: string | null
  delivered_at: string | null
  unlocked_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  timeline: { at: string; label: string }[]
  next_payment: NextPayment
  created_at: string
  // client shape only
  payment_instructions?: { zelle: string; zelle_phone?: string; memo: string; methods: string[] }
}

export type BookingInput = {
  client_user_id?: number
  client?: { full_name: string; email: string }
  client_phone: string
  event_type: string
  event_date?: string
  start_time: string
  end_time: string
  location: string
  package_key: string
  // custom packages only
  package_name?: string
  hours?: number
  total_fee_cents?: number | null
  includes_video?: boolean
  hourly_rate_cents?: number
  revisions?: number
  details_for_client?: string
  notes_internal?: string
}

export type BookingPreview = {
  amounts: {
    total_fee: number
    total_due: number
    retainer: number
    event_day: number
    final: number
  }
  contract_markdown: string
}