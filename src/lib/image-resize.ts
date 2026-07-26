/**
 * Downscales a photo in the browser before it's uploaded. Phone cameras
 * routinely produce 3000-4000px, multi-megabyte JPEGs — far more than
 * YouCam needs (480px minimum, 10MB cap) and more than we want going over a
 * mobile connection or through the server action body limit. Only shrinks;
 * images already at or under `maxDimension` are returned untouched so we
 * don't re-compress (and lose quality on) an already-small photo.
 */
export async function resizeImageForUpload(
  file: File,
  { maxDimension = 1600, quality = 0.85 }: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap;
  try {
    // `imageOrientation: "from-image"` bakes the EXIF rotation into the
    // decoded pixels — canvas export below has no EXIF field of its own, so
    // without this a portrait selfie can come out sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Formats canvas can't decode (e.g. HEIC in some non-WebKit browsers)
    // fall through untouched; the upload/vendor path handles the error.
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;

  const name = file.name.replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
}
