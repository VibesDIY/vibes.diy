import { useState, useEffect } from 'react';

interface ImgFileProps {
  file: { file: () => Promise<File>; type: string };
  alt: string;
  className?: string;
  withBlurredBg?: boolean;
  maxHeight?: string;
}

/**
 * Component to display an image file from a Fireproof file attachment
 * It handles loading the file and converting it to a data URL
 * Can optionally display with a blurred background and variable height foreground
 */
export function ImgFile({ file, alt, className, withBlurredBg = false, maxHeight = '10rem' }: ImgFileProps) {
  const [imgDataUrl, setImgDataUrl] = useState('');

  useEffect(() => {
    if (file.type && /image/.test(file.type)) {
      file.file().then((file: File) => {
        const src = URL.createObjectURL(file);
        setImgDataUrl(src);
        return () => URL.revokeObjectURL(src);
      });
    }
  }, [file]);

  if (!imgDataUrl) return null;
  
  // If we want the fancy blurred background version
  if (withBlurredBg) {
    return (
      <div className="relative w-full overflow-hidden" style={{ minHeight: maxHeight }}>
        {/* Extremely blurred background version (50x blur) */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img 
            className="w-full h-full object-cover scale-110" 
            alt="" 
            src={imgDataUrl} 
            style={{ filter: 'blur(10px)', opacity: 0.9 }}
          />
        </div>
        
        {/* Foreground image with variable height */}
        <div className="relative z-10 flex justify-center w-full py-2">
          <img 
            className={`${className} max-w-full object-contain`} 
            style={{ maxHeight }} 
            alt={alt} 
            src={imgDataUrl} 
          />
        </div>
      </div>
    );
  }

  // Default fixed-height version
  return (
    <img className={`${className} w-full h-40 object-cover`} alt={alt} src={imgDataUrl} />
  );
}
