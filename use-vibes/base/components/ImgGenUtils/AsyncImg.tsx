import * as React from 'react';
import { DocFileMeta } from '@fireproof/use-fireproof';

interface AsyncImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  file: DocFileMeta | File | null | undefined;
}

/**
 * AsyncImg component that converts DocFileMeta to blob URL and displays image.
 * Simpler alternative to ImgFile that avoids blob cleanup issues.
 */
export function AsyncImg({ file, ...props }: AsyncImgProps) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;

    // Handle null/undefined file
    if (!file) {
      setSrc(null);
      return;
    }

    // Handle both File objects (direct) and DocFileMeta objects (with .file() method)
    if ('file' in file && typeof file.file === 'function') {
      // This is a DocFileMeta object
      file
        .file()
        .then((fileObj) => {
          if (!isMounted) return;

          // Only create blob URL for image files
          if (fileObj.type.startsWith('image/')) {
            objectUrl = URL.createObjectURL(fileObj);
            setSrc(objectUrl);
          }
        })
        .catch((error) => {
          console.error('[AsyncImg] Failed to load file:', error);
        });
    } else if (file instanceof File) {
      // This is a direct File object (likely from tests)
      if (file.type.startsWith('image/')) {
        objectUrl = URL.createObjectURL(file);
        setSrc(objectUrl);
      }
    }

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  return src ? <img src={src} {...props} /> : null;
}
