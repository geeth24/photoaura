// keeps each request well under the proxy (5000 MB) and ingress (5 GB) caps
export const MAX_BATCH_BYTES = 1024 * 1024 * 1024
export const MAX_BATCH_FILES = 50
export const BATCH_RETRIES = 2

/** Group files, in order, into batches under both caps. A file bigger than the byte cap gets a batch to itself. */
export function planBatches<T extends { size: number }>(files: T[]): T[][] {
  const batches: T[][] = []
  let current: T[] = []
  let bytes = 0
  for (const file of files) {
    const full =
      current.length >= MAX_BATCH_FILES || bytes + file.size > MAX_BATCH_BYTES
    if (current.length && full) {
      batches.push(current)
      current = []
      bytes = 0
    }
    current.push(file)
    bytes += file.size
  }
  if (current.length) batches.push(current)
  return batches
}
