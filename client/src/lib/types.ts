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