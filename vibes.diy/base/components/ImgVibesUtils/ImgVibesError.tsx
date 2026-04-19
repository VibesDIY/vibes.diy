import * as React from "react";
import { ImgVibesErrorProps } from "./types.js";
import { combineClasses, defaultClasses } from "../../utils/style-utils.js";
import { imgVibesStyles } from "../../utils/styles.js";

// Component for displaying errors
export function ImgVibesError({ message, className, classes = defaultClasses }: Partial<ImgVibesErrorProps>) {
  return (
    <div className={combineClasses("imggen-error-container", className, classes.error)} style={imgVibesStyles.error}>
      <h3 style={imgVibesStyles.errorTitle}>Error</h3>
      <p style={imgVibesStyles.errorMessage}>{message || "Failed to render image"}</p>
    </div>
  );
}
