import * as React from 'react';
import { ImgGenPlaceholderProps } from './types.js';
import { combineClasses, defaultClasses } from '../../utils/style-utils.js';
import { imgGenStyles, imgGenTheme } from '../../utils/styles.js';
import { ImageOverlay } from './overlays/ImageOverlay.js';

// Component for loading/placeholder state
export function ImgGenDisplayPlaceholder({
  className,
  alt,
  prompt,
  progress,
  error,
  classes = defaultClasses,
}: ImgGenPlaceholderProps) {
  // State to track the visible progress width for animation
  const [visibleProgress, setVisibleProgress] = React.useState(0);

  // Animate progress bar when component mounts or progress changes
  React.useEffect(() => {
    // Only start at zero on initial mount, not on every progress update
    if (progress === 0) {
      setVisibleProgress(0);
    }

    // Smoothly animate to the actual progress (or minimum 5%)
    const timer = setTimeout(() => {
      setVisibleProgress(Math.max(5, progress));
    }, 20); // Smaller delay for smoother transitions

    return () => clearTimeout(timer);
  }, [progress]);
  // Extract error information from the error object
  const parseErrorInfo = (error: Error) => {
    const errorMsg = error.message;
    let title = 'Image Generation Failed';
    let body = errorMsg;
    let code = '';

    // Try to parse JSON error details if present
    if (errorMsg.includes('{')) {
      try {
        const jsonStart = errorMsg.indexOf('{');
        const jsonStr = errorMsg.substring(jsonStart);
        const jsonObj = JSON.parse(jsonStr);

        // Get error code if it exists
        if (errorMsg.match(/\d{3}/)) {
          code = errorMsg.match(/\d{3}/)?.[0] || '';
        }

        // Special handling for moderation blocked errors
        if (
          jsonObj.details?.error?.code === 'moderation_blocked' ||
          jsonObj.code === 'moderation_blocked'
        ) {
          // Include error code in title but avoid duplication
          title = code ? `${code} - Failed to generate image` : 'Failed to generate image';
          body =
            'Your request was rejected as a result of our safety system. Your request may contain content that is not allowed by our safety system.';
          return { title, body, code };
        }

        // Set the title from the main error message
        if (jsonObj.error) {
          title = jsonObj.error;
        }

        // Set the body from the detailed error message
        if (jsonObj.details?.error?.message) {
          body = jsonObj.details.error.message;
        } else if (jsonObj.error?.details?.error?.message) {
          body = jsonObj.error.details.error.message;
        }
      } catch {
        /* */
      }
    }

    return { title, body, code };
  };

  // Check if we're displaying an error
  if (error) {
    return (
      <div
        className={combineClasses(className, classes.placeholder)}
        style={{
          ...imgGenStyles.errorContainer,
          minHeight: '512px', // Standard image height
        }}
        aria-label={alt || 'Error display'}
        role="img"
      >
        <div className={combineClasses(classes.error)} style={imgGenStyles.error}>
          {(() => {
            const { title, body } = parseErrorInfo(error);
            return (
              <>
                <h3 style={imgGenStyles.errorTitle}>{title}</h3>
                <p style={imgGenStyles.errorMessage}>{body}</p>
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  // Regular placeholder when no error
  return (
    <div
      className={combineClasses(className, classes.placeholder)}
      aria-label={alt || prompt || 'Image placeholder'}
      role="img"
      style={{
        ...imgGenStyles.placeholder,
        flexDirection: 'column',
        textAlign: 'center',
        minHeight: '200px',
        color: '#eee', // Light text color
      }}
    >
      {/* Progress bar at the very top */}
      {prompt && (
        <div style={imgGenStyles.progressContainer}>
          <div
            className={combineClasses(classes.progress)}
            style={{
              ...imgGenStyles.progress,
              width: `${visibleProgress}%`,
            }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Simple status text for 'waiting for prompt' state */}
      {!prompt && (
        <div
          style={{
            ...imgGenStyles.statusText,
            color: '#eee',
            padding: '20px',
          }}
        >
          Waiting for prompt
        </div>
      )}

      {/* When prompt exists and we have no error, handle differently in test vs production */}
      {prompt && !error && (
        /* In production environment, show the styled prompt text */
        <>
          <div
            style={{
              color: '#eee',
              fontSize: imgGenTheme.typography.fontSize,
              padding: '20px',
              maxWidth: '90%',
              wordBreak: 'break-word',
              fontWeight: imgGenTheme.typography.fontWeight,
              textAlign: 'center',
            }}
          >
            {prompt}
          </div>

          <div style={{ display: 'none' }}>
            <ImageOverlay
              promptText={prompt || ''}
              editedPrompt={null}
              setEditedPrompt={() => {
                /* noop */
              }}
              handlePromptEdit={() => {
                /* noop */
              }}
              handleDeleteConfirm={() => {
                /* noop */
              }}
              handlePrevVersion={() => {
                /* noop */
              }}
              handleNextVersion={() => {
                /* noop */
              }}
              handleRegen={() => {
                /* noop */
              }}
              versionIndex={0}
              totalVersions={1}
              classes={classes}
              showControls={false}
              showDelete={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
