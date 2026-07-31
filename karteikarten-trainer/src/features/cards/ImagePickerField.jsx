import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { resizeImageToBlob } from "../../lib/imageResize.js";

// `value` is null (no image), a Blob (freshly picked, not yet saved) or a
// string (existing URL/data-URL). Shows a small "Bild hinzufügen" button
// when empty, or a thumbnail + remove button once an image is set — no
// placeholder at all when there's nothing to show.
export function ImagePickerField({ value, onChange, label }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  // Object URL for a freshly-picked Blob is (re)created during render via
  // this "adjust state during render" pattern — the effect below only
  // revokes it again once it's no longer current (replaced or unmounted),
  // it never itself calls setState.
  const [blobPreview, setBlobPreview] = useState({ blob: null, url: null });

  if (value instanceof Blob && blobPreview.blob !== value) {
    setBlobPreview({ blob: value, url: URL.createObjectURL(value) });
  } else if (!(value instanceof Blob) && blobPreview.blob !== null) {
    setBlobPreview({ blob: null, url: null });
  }

  useEffect(() => {
    return () => {
      if (blobPreview.url) URL.revokeObjectURL(blobPreview.url);
    };
  }, [blobPreview.url]);

  const previewUrl = value instanceof Blob ? blobPreview.url : value || null;

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    try {
      const blob = await resizeImageToBlob(file);
      onChange(blob);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="image-picker-field">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {previewUrl ? (
        <div className="image-picker-preview">
          <img src={previewUrl} alt={`${label}-Bild`} />
          <button
            type="button"
            className="image-picker-remove"
            onClick={() => onChange(null)}
            aria-label={`${label}-Bild entfernen`}
          >
            <X className="h-3.5 w-3.5" />
            Entfernen
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="image-picker-add"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          Bild hinzufügen
        </button>
      )}

      {error && <p className="image-picker-error">{error}</p>}
    </div>
  );
}
