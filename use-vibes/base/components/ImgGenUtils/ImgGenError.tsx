import * as React from 'react';
import { ImgGenErrorProps } from './types.js';
import { combineClasses, defaultClasses } from '../../utils/style-utils.js';
import { imgGenStyles } from '../../utils/styles.js';

// Component for displaying errors
export function ImgGenError({
  message,
  className,
  classes = defaultClasses,
}: Partial<ImgGenErrorProps>) {
  return (
    <div className={combineClasses(className, classes.error)} style={imgGenStyles.error}>
      <h3 style={imgGenStyles.errorTitle}>Error</h3>
      <p style={imgGenStyles.errorMessage}>{message || 'Failed to render image'}</p>
    </div>
  );
}
