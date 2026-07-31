const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

// Downscales/recompresses a picked image file client-side before it's
// uploaded (cloud) or stored as a data URL (local) — keeps storage/transfer
// costs down regardless of how big the original photo was.
export function resizeImageToBlob(file, maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Bild konnte nicht verarbeitet werden."))),
        "image/jpeg",
        quality
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Bild konnte nicht gelesen werden."));
    };

    image.src = objectUrl;
  });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
}
