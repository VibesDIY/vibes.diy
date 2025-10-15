// Template scripts with JavaScript syntax highlighting via comment directive
export const scripts = /* javascript */ `
      // Event handling for VibeControl integration
      document.addEventListener('DOMContentLoaded', () => {
        // Handle invite form submission using custom events
        const inviteForm = document.getElementById('invite-form');
        if (inviteForm) {
          inviteForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Get form data
            const formData = new FormData(inviteForm);
            const email = formData.get('email');
            const role = formData.get('role') || 'member';
            const right = formData.get('right') || 'read';

            if (!email) {
              console.error('Email is required');
              return;
            }

            // Dispatch custom event to trigger share
            document.dispatchEvent(new CustomEvent('vibes-share-request', {
              detail: {
                email: email,
                role: role,
                right: right
              }
            }));
          });
        }

        // Listen for share success
        document.addEventListener('vibes-share-success', (e) => {
          console.log('Share successful:', e.detail);

          // Find the invite form and show success message
          const inviteForm = document.getElementById('invite-form');
          if (inviteForm) {
            const input = inviteForm.querySelector('.remix-input');

            if (input) {
              // Show success feedback
              input.style.backgroundColor = 'rgba(220, 255, 220, 0.8)';
              input.value = '';
              input.placeholder = 'Invited! Add another?';

              setTimeout(() => {
                input.style.backgroundColor = '';
                input.placeholder = 'friend@example.com';
              }, 3000);
            }
          }
        });

        // Listen for share error
        document.addEventListener('vibes-share-error', (e) => {
          console.error('Share failed:', e.detail.error);

          // Find the invite form and show error message
          const inviteForm = document.getElementById('invite-form');
          if (inviteForm) {
            const input = inviteForm.querySelector('.remix-input');

            if (input) {
              // Show error feedback
              input.style.backgroundColor = 'rgba(255, 220, 220, 0.8)';
              input.placeholder = 'Error - try again';

              setTimeout(() => {
                input.style.backgroundColor = '';
                input.placeholder = 'friend@example.com';
              }, 3000);
            }
          }
        });

        // Wire up login buttons to dispatch sync enable events
        const loginButtons = [
          document.getElementById('vibes-login-link'),
          document.getElementById('vibes-login-link-connected')
        ];

        loginButtons.forEach(button => {
          if (button) {
            button.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Dispatch custom event to enable sync
              document.dispatchEvent(new CustomEvent('vibes-sync-enable'));
            });
          }
        });
      });
`;

// Network activity tracker script - separate for clarity
export const networkTracker = /* javascript */ `
    // Network activity tracker for a single page
    (function() {
      const activeRequests = new Set();
      let lastState = null;

      // Function to update the DOM based on network state
      function updateNetworkState() {
        const currentState = activeRequests.size > 0;
        if (currentState !== lastState) {
          lastState = currentState;
          
          // Add or remove class on body based on network state
          if (currentState) {
            document.body.classList.add('network-active');
            
            // Restart SVG animations by targeting animation elements
            const indicatorImg = document.querySelector('.indicator-svg img');
            if (indicatorImg) {
              restartSvgAnimations(indicatorImg);
            }
          } else {
            document.body.classList.remove('network-active');
            
            // Clean up SVG animations when network activity ends
            const indicatorImg = document.querySelector('.indicator-svg img');
            if (indicatorImg) {
              cleanupSvgAnimations(indicatorImg);
            }
          }
        }
      }

      // Function to restart SVG animations
      function restartSvgAnimations(imgElement) {
        try {
          // Get the SVG document if it's an SVG
          const svgDoc = imgElement.contentDocument || imgElement.getSVGDocument?.();
          if (svgDoc) {
            // Find all animation elements and restart them
            const animations = svgDoc.querySelectorAll('animate, animateTransform, animateMotion, set');
            animations.forEach(anim => {
              try {
                anim.beginElement();
              } catch (e) {
                // Fallback: manipulate begin attribute
                const currentTime = svgDoc.documentElement.getCurrentTime?.() || 0;
                anim.setAttribute('begin', currentTime + 's');
              }
            });
          } else {
            // For regular img elements, try to trigger re-parse by modifying src with timestamp
            const currentSrc = imgElement.src;
            if (currentSrc.includes('?')) {
              imgElement.src = currentSrc.split('?')[0] + '?t=' + Date.now();
            } else {
              imgElement.src = currentSrc + '?t=' + Date.now();
            }
          }
        } catch (e) {
          console.log('Could not restart SVG animation:', e);
        }
      }

      // Function to cleanup/stop SVG animations
      function cleanupSvgAnimations(imgElement) {
        try {
          // Get the SVG document if it's an SVG
          const svgDoc = imgElement.contentDocument || imgElement.getSVGDocument?.();
          if (svgDoc) {
            // Find all animation elements and end them
            const animations = svgDoc.querySelectorAll('animate, animateTransform, animateMotion, set');
            animations.forEach(anim => {
              try {
                anim.endElement();
              } catch (e) {
                // Fallback: set begin to a future time to stop current animation
                anim.setAttribute('begin', 'indefinite');
              }
            });
          }
        } catch (e) {
          console.log('Could not cleanup SVG animation:', e);
        }
      }

      // Save original fetch function
      const originalFetch = window.fetch;
      
      // Override fetch to track requests
      window.fetch = (...args) => {
        const reqInfo = args[0];
        activeRequests.add(reqInfo);
        updateNetworkState();

        return originalFetch(...args).then((res) => {
          if (!res.body) {
            activeRequests.delete(reqInfo);
            updateNetworkState();
            return res;
          }
          
          // Handle streaming responses
          const reader = res.body.getReader();
          const stream = new ReadableStream({
            start(controller) {
              function pump() {
                reader.read().then(({ done, value }) => {
                  if (done) {
                    activeRequests.delete(reqInfo);
                    updateNetworkState();
                    controller.close();
                    return;
                  }
                  controller.enqueue(value);
                  pump();
                });
              }
              pump();
            },
          });
          return new Response(stream, { headers: res.headers });
        }).catch(err => {
          // Make sure to clean up if fetch fails
          activeRequests.delete(reqInfo);
          updateNetworkState();
          throw err; // Re-throw the error
        });
      };
    })();
`;
