import * as React from 'react';
import { ImgGenErrorProps } from './types.js';
import { combineClasses, defaultClasses } from '../../utils/style-utils.js';

// Component for displaying errors
export function ImgGenError({
  message,
  className,
  classes = defaultClasses,
}: Partial<ImgGenErrorProps>) {
  return (
    <div className={combineClasses('imggen-error', className, classes.error)}>
      <h3 className="imggen-error-title">Error</h3>
      <p className="imggen-error-message">{message || 'Failed to render image'}</p>
    </div>
  );
}
