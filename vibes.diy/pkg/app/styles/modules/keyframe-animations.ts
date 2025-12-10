/**
 * Keyframe Animations
 * All @keyframes declarations for UI animations
 *
 * Extracted from global-styles.ts lines 323-435
 */

export const keyframeAnimations = `
/* ============================================
   KEYFRAME ANIMATIONS
   ============================================ */

/* Animation for share status message */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Animation for new chat bounce effect */
@keyframes bounceIn {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Button glimmer animation */
@keyframes buttonGlimmer {
  0% {
    background-position: -100% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Gradient animation for glimmer */
@keyframes gradientGlimmer {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

@keyframes pulse {
  0% {
    transform: rotate(-5deg) scale(1);
  }
  50% {
    transform: rotate(0deg) scale(1.05);
  }
  100% {
    transform: rotate(-5deg) scale(1);
  }
}

@keyframes logo-rotate {
  0% {
    transform: rotate(45deg) scale(5.5);
  }
  66% {
    transform: rotate(0deg) scale(1);
  }
  100% {
    transform: rotate(45deg) scale(5.5);
  }
}

@keyframes logo-pulse-height {
  0% {
    width: 200%;
  }
  50% {
    width: 20%;
  }
  100% {
    width: 200%;
  }
}

/* Animated gradient background utility */
@keyframes gradient-x {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* === Loading stripes overlay === */
@keyframes moving-stripes {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 40px 0;
  }
}
`.trim();
