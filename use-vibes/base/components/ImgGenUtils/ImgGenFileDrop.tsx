import * as React from 'react';
import { combineClasses } from '../../utils/style-utils.js';
import '../ImgGen.css';

interface ImgGenFileDropProps {
  /** Callback when files are dropped or selected via browse */
  readonly onFilesDropped: (files: File[]) => void;
  /** Classname(s) to apply to the container */
  readonly className?: string;
  /** Whether the drop zone is active */
  readonly isActive?: boolean;
  /** Max number of files allowed */
  readonly maxFiles?: number;
  /** Enable debugging output */
  readonly debug?: boolean;
  /** Custom message to display in drop zone */
  readonly addFilesMessage?: string;
}

/**
 * Simple file drop zone component for handling image uploads
 */
export function ImgGenFileDrop({
  onFilesDropped,
  className,
  isActive = true,
  maxFiles = 10,
  debug,
  addFilesMessage = 'Drop images here or click to browse',
}: ImgGenFileDropProps): React.ReactElement {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleClick = React.useCallback(() => {
    if (isActive && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [isActive]);

  const processFiles = React.useCallback(
    (fileList: FileList) => {
      if (!isActive) return;

      const files = Array.from(fileList);
      if (files.length === 0) return;

      // Apply max files limit
      const filesToProcess = files.slice(0, maxFiles);

      if (debug) {
        console.log(
          `[ImgGenFileDrop] Processing ${filesToProcess.length} files of ${files.length} selected`
        );
      }

      // Filter out non-image files
      const imageFiles = filesToProcess.filter((file) => file.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        onFilesDropped(imageFiles);
      }
    },
    [isActive, maxFiles, onFilesDropped, debug]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleFileInput = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  return (
    <div
      className={combineClasses(
        'imggen-file-drop',
        isDragging ? 'imggen-file-drop-active' : '',
        !isActive ? 'imggen-file-drop-disabled' : '',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileInput}
        multiple
        style={{ display: 'none' }}
      />
      <div className="imggen-file-drop-message">{addFilesMessage}</div>
    </div>
  );
}
