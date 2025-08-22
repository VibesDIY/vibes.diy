interface ImagePreviewItem {
  id: string;
  previewUrl: string;
  mimeType: string;
}

export function ImagePreview({
  images,
  onRemove,
}: {
  images: ImagePreviewItem[];
  onRemove: (id: string) => void | Promise<void>;
}) {
  if (!images || images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((img) => (
        <div
          key={img.id}
          className="border-light-decorative-00 dark:border-dark-decorative-00 relative h-16 w-16 overflow-hidden rounded border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.previewUrl}
            alt="attachment"
            className="h-full w-full object-cover"
            draggable={false}
          />
          <button
            type="button"
            onClick={() => onRemove(img.id)}
            aria-label="Remove image"
            className="absolute top-0 right-0 m-0.5 rounded bg-black/60 px-1 text-[10px] leading-4 font-semibold text-white hover:bg-black/80"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default ImagePreview;
