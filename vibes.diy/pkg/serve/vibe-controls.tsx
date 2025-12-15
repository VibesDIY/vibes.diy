/**
 * Vibe Controls - Server-Side Rendered JSX Template
 *
 * Pure JSX template for SSR vibe controls (no React runtime dependencies).
 * Renders VibesSwitch (SVG toggle) and VibesPanel (settings panel) as static HTML.
 *
 * Architecture:
 * - All three panel modes (default/mutate/invite) rendered upfront
 * - Modes toggled via CSS (data-mode-hidden attribute)
 * - No event handlers in JSX (added by vibe-controls-scripts.ts later)
 * - Self-contained with inline styles
 */

import React from "react";
// import { vibeControlsCSS } from "./vibes-controls/vibe-controls-styles.js";
// import { vibeControlsScripts } from "./vibes-controls/scripts.js";

export default function VibeControls() {
  return (
    <>
      <div data-vibe-controls-container>
        {/* VibesSwitch - SVG Toggle Button */}
        <button data-vibe-switch aria-label="Toggle settings" type="button">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="80"
            viewBox="0 0 600 300"
            fill="currentColor"
          >
            {/* Background pill shape (black) */}
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              fill="#000"
              d="M293.353,298.09c-41.038,0-82.078,0.125-123.115-0.077  c-11.993-0.06-24.011-0.701-35.964-1.703c-15.871-1.331-29.73-7.937-41.948-17.946c-16.769-13.736-27.207-31.417-30.983-52.7  c-4.424-24.93,1.404-47.685,16.506-67.913c11.502-15.407,26.564-26.1,45.258-30.884c7.615-1.949,15.631-2.91,23.501-3.165  c20.08-0.652,40.179-0.853,60.271-0.879c69.503-0.094,139.007-0.106,208.51,0.02c14.765,0.026,29.583,0.097,44.28,1.313  c36.984,3.059,61.78,23.095,74.653,57.301c17.011,45.199-8.414,96.835-54.29,111.864c-7.919,2.595-16.165,3.721-24.434,3.871  c-25.614,0.467-51.234,0.742-76.853,0.867C350.282,298.197,321.817,298.09,293.353,298.09z"
            />

            {/* Morphing white circle/stretched shape */}
            {/* Default state: stretchedD (oval on left, under "VIBES") */}
            {/* Active (open) state: originalD (circle on right, under "DIY") */}
            <path
              className="morphing"
              fill="#fff"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M165.866,285.985c-7.999-0.416-19.597-0.733-31.141-1.687  c-15.692-1.297-28.809-8.481-40.105-19.104c-12.77-12.008-20.478-26.828-22.714-44.177c-3.048-23.644,3.384-44.558,19.646-62.143  c9.174-9.92,20.248-17.25,33.444-20.363c7.786-1.837,15.944-2.399,23.973-2.828c9.988-0.535,121.023-0.666,131.021-0.371  c10.191,0.301,20.433,0.806,30.521,2.175c12.493,1.696,23.132,7.919,32.552,16.091c14.221,12.337,22.777,27.953,25.184,46.594  c2.822,21.859-2.605,41.617-16.777,58.695c-9.494,11.441-21.349,19.648-35.722,23.502c-6.656,1.785-13.724,2.278-20.647,2.77  C286.914,285.721,177.682,285.667,165.866,285.985z"
            />

            {/* V letter */}
            <path
              className="logo-vibes"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M135.138,229.842c-2.941-0.084-5.296-1.462-6.684-3.9  c-1.827-3.21-3.328-6.618-4.81-10.011c-3.55-8.128-7.021-16.291-10.486-24.455c-0.48-1.132-0.902-2.329-1.087-3.536  c-0.417-2.72,1.238-4.585,3.938-4.119c1.591,0.275,3.569,0.98,4.45,2.173c2.226,3.015,4.175,6.299,5.784,9.69  c2.208,4.654,3.898,9.552,6.032,14.244c0.628,1.379,2.009,2.416,3.045,3.609c0.892-1.159,2.042-2.201,2.63-3.498  c2.697-5.953,5.22-11.985,7.841-17.974c1.423-3.252,3.089-6.418,6.532-7.905c1.238-0.535,3.012-0.712,4.184-0.214  c0.81,0.344,1.377,2.126,1.385,3.271c0.009,1.458-0.479,2.997-1.059,4.371c-4.227,10.013-8.504,20.005-12.833,29.974  c-0.79,1.819-1.762,3.589-2.875,5.229C139.73,228.848,137.671,229.894,135.138,229.842z"
            />

            {/* I letter */}
            <path
              className="logo-vibes"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M164.636,206.263c0-6.691,0.054-13.383-0.036-20.073  c-0.024-1.851,0.716-2.67,2.449-2.81c0.274-0.022,0.549-0.054,0.823-0.076c5.488-0.445,6.091,0.105,6.091,5.562  c0,12.348,0,24.695,0,37.043c0,2.887-0.354,3.405-3.222,3.618c-1.628,0.121-3.338-0.001-4.91-0.408  c-0.593-0.153-1.265-1.408-1.278-2.171c-0.096-5.584-0.034-11.172-0.022-16.759c0.002-1.308,0-2.617,0-3.926  C164.566,206.263,164.601,206.263,164.636,206.263z"
            />

            {/* B letter */}
            <path
              className="logo-vibes"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M181.891,205.861c0-5.043-0.001-10.086,0-15.129  c0.001-5.046,1.679-7.539,6.606-7.695c9.292-0.294,18.653-1.051,27.888,0.707c7.614,1.449,11.523,5.954,11.902,13.446  c0.066,1.312-0.313,2.752-0.857,3.966c-1.401,3.123-1.399,6.266-0.673,9.507c0.301,1.342,0.443,2.723,0.787,4.053  c1.274,4.925-1.78,10.114-6.085,11.937c-3.111,1.318-6.561,2.327-9.909,2.497c-7.303,0.37-14.639,0.136-21.96,0.101  c-1.165-0.005-2.345-0.181-3.488-0.422c-2.657-0.56-4.162-2.962-4.197-6.801C181.854,216.639,181.891,211.25,181.891,205.861z   M204.442,192.385c-2.757,0-5.514,0-8.271,0c-3.695,0-5.151,1.669-4.712,5.403c0.369,3.14,1.05,3.735,4.225,3.737  c5.024,0.004,10.05,0.109,15.07-0.014c2.028-0.05,4.167-0.27,6.04-0.98c3.182-1.207,3.639-4.256,1.008-6.455  c-1.073-0.896-2.659-1.509-4.06-1.618C210.659,192.220,207.544,192.385,204.442,192.385z M204.334,211.104c0,0.045,0,0.091,0,0.137  c-3.101,0-6.203-0.055-9.302,0.037c-0.823,0.024-2.257,0.373-2.344,0.794c-0.447,2.154-0.959,4.444-0.639,6.563  c0.276,1.822,2.447,1.451,3.882,1.441c5.989-0.042,11.98-0.118,17.961-0.385c1.416-0.063,2.859-0.79,4.176-1.441  c1.79-0.886,1.833-2.475,1.029-4.046c-1.166-2.276-3.297-3.024-5.677-3.081C210.394,211.049,207.363,211.104,204.334,211.104z"
            />

            {/* E letter */}
            <path
              className="logo-vibes"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M235.786,208.14c0-6.905-0.01-13.809,0.004-20.714  c0.007-3.474,0.948-4.428,4.415-3.758c6.62,1.279,13.232,2.651,19.759,4.331c1.7,0.438,3.404,1.896,4.515,3.341  c1.777,2.31,0.433,5.367-2.463,5.745c-1.86,0.243-3.819-0.138-5.717-0.368c-2.183-0.264-4.339-0.783-6.525-0.976  c-1.572-0.138-3.065,0.375-3.8,1.959c-0.76,1.638-0.319,3.329,0.942,4.34c1.619,1.296,3.522,2.327,5.447,3.128  c2.146,0.894,4.539,1.207,6.66,2.145c1.446,0.64,2.982,1.687,3.786,2.981c0.689,1.11,0.928,3.094,0.378,4.202  c-0.492,0.991-2.32,1.795-3.579,1.825c-2.238,0.052-4.483-0.652-6.741-0.832c-1.614-0.127-3.333-0.203-4.865,0.212  c-2.574,0.699-3.225,3.013-1.719,5.218c1.396,2.044,3.431,3.141,5.757,3.761c2.791,0.744,5.637,1.315,8.373,2.222  c3.19,1.058,4.791,3.496,4.801,6.723c0.011,3.365-1.759,5.021-5.138,4.424c-4.402-0.778-8.759-1.81-13.134-2.735  c-2.357-0.499-4.718-0.981-7.069-1.511c-3.263-0.737-4.132-1.805-4.141-5.154c-0.019-6.836-0.006-13.672-0.006-20.508  C235.747,208.141,235.766,208.14,235.786,208.14z"
            />

            {/* S letter */}
            <path
              className="logo-vibes"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M291.409,229.748c-3.621-0.394-7.838-0.587-11.94-1.379  c-3.577-0.69-6.343-2.991-8.213-6.163c-1.763-2.99-0.301-5.6,3.139-5.292c2.287,0.205,4.512,1.129,6.758,1.755  c6.281,1.751,12.643,1.892,19.053,0.951c0.667-0.098,1.31-0.416,1.941-0.686c1.502-0.644,2.55-1.682,2.581-3.415  c0.031-1.74-1.195-2.749-2.579-3.132c-2.298-0.637-4.688-1.021-7.065-1.273c-5.062-0.536-10.252-0.401-15.187-1.475  c-9.677-2.105-11.678-10.53-10.101-16.009c1.62-5.625,5.911-8.92,11.318-9.73c8.388-1.257,16.925-1.491,25.279,0.654  c3.702,0.951,6.615,3.072,7.883,6.931c0.918,2.792-0.332,4.6-3.268,4.357c-1.684-0.139-3.367-0.676-4.974-1.248  c-6.711-2.387-13.572-2.897-20.569-1.783c-1.001,0.159-2.146,0.414-2.875,1.034c-0.901,0.766-2.016,1.981-1.98,2.964  c0.041,1.128,0.995,2.733,1.991,3.206c1.81,0.857,3.925,1.279,5.948,1.441c5.152,0.41,10.356,0.296,15.479,0.905  c7.98,0.949,13.779,9.833,11.241,17.125c-1.959,5.628-6.44,8.489-12.143,9.322C299.455,229.344,295.715,229.419,291.409,229.748z"
            />

            {/* D letter */}
            <path
              className="logo-diy"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M388.313,210.147c0-6.356,0.034-12.713-0.023-19.069  c-0.015-1.61,0.359-2.472,2.19-2.346c2.887,0.198,5.809,0.045,8.671,0.398c4.396,0.542,8.019,4.294,8.144,8.904  c0.223,8.142,0.265,16.304-0.074,24.439c-0.248,5.945-4.552,9.662-10.491,9.831c-1.999,0.057-4.003-0.081-6.006-0.09  c-1.746-0.008-2.439-0.853-2.428-2.584C388.34,223.136,388.313,216.642,388.313,210.147z M393.418,210.324c-0.037,0-0.075,0-0.114,0  c0,4.55-0.038,9.101,0.015,13.65c0.031,2.688,0.926,3.439,3.56,3.239c3.273-0.248,5.493-2.511,5.534-6.04  c0.082-7.099,0.054-14.2-0.033-21.299c-0.041-3.268-1.739-5.241-4.87-6.092c-2.68-0.728-4.025,0.161-4.07,2.896  C393.364,201.226,393.418,205.775,393.418,210.324z"
            />

            {/* I letter (second) */}
            <path
              className="logo-diy"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M440.516,210.627c0,6.281,0.007,12.563-0.004,18.844  c-0.004,2.067-0.805,3.038-2.531,3.015c-1.877-0.025-2.365-1.136-2.359-2.876c0.046-12.631,0.019-25.263,0.029-37.895  c0.002-2.592,0.525-3.205,2.419-3.148c1.856,0.057,2.479,1.03,2.466,2.803C440.484,197.788,440.515,204.208,440.516,210.627z"
            />

            {/* Y letter (dot 1) */}
            <path
              className="logo-diy"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M416.875,210.721c0.068-3.305,1.849-5.306,4.727-5.309  c2.765-0.003,4.924,2.404,4.816,5.371c-0.106,2.956-2.355,5.212-5.12,5.138C418.626,215.849,416.813,213.718,416.875,210.721z"
            />

            {/* Y letter (dot 2) */}
            <path
              className="logo-diy"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M449.933,210.636c0.102-3.331,1.886-5.279,4.778-5.22  c2.67,0.055,4.829,2.432,4.762,5.243c-0.073,3.021-2.404,5.36-5.242,5.261C451.606,215.829,449.84,213.657,449.933,210.636z"
            />

            {/* Parenthesis */}
            <path
              className="logo-diy"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M478.079,200.8c0.674-1.566,1.121-2.53,1.506-3.519  c0.673-1.73,1.252-3.5,1.981-5.205c0.315-0.737,0.766-1.654,1.407-1.961c1.094-0.523,2.388-0.63,3.598-0.912  c0.205,1.142,0.798,2.381,0.537,3.404c-0.606,2.388-1.448,4.756-2.507,6.984c-3.981,8.389-4.352,17.254-3.78,26.282  c0.091,1.438,0.031,2.899-0.105,4.335c-0.14,1.473-0.989,2.428-2.542,2.497c-1.514,0.067-2.311-0.903-2.54-2.23  c-0.232-1.348-0.394-2.754-0.277-4.108c0.94-10.972-1.116-21.38-5.626-31.375c-0.586-1.298-0.899-2.762-1.093-4.183  c-0.233-1.712,0.825-2.592,2.379-1.843c1.164,0.561,2.345,1.55,2.973,2.657c1.078,1.897,1.712,4.043,2.568,6.07  C476.918,198.547,477.370,199.361,478.079,200.8z"
            />
          </svg>
        </button>

        {/* VibesPanel - Settings Panel (initially hidden) */}
        <div data-vibe-panel data-panel-hidden>
          {/* Default mode - 4 buttons with LabelContainer */}
          <div data-panel-mode="default">
            <div data-label-container>
              <div data-label data-disappear>
                <span>Launcher</span>
              </div>
              <div data-button-wrapper>
                {/* Logout Button */}
                <button
                  data-action="logout"
                  data-variant="blue"
                  data-has-icon
                  type="button"
                >
                  <div data-content-wrapper>
                    <div data-icon-container>
                      <div data-icon>
                        <svg
                          width="45"
                          height="45"
                          viewBox="0 0 44 44"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="22"
                            cy="22"
                            r="22"
                            fill="var(--vibes-button-icon-bg)"
                          />
                          <path
                            d="M21.895 25.562C23.266 25.562 24.581 25.0176 25.5506 24.048C26.5202 23.0784 27.0646 21.7635 27.0646 20.3922C27.0646 19.021 26.5202 17.7061 25.5506 16.7365C24.581 15.7669 23.266 15.2225 21.895 15.2225C20.524 15.2225 19.2089 15.7669 18.2393 16.7365C17.2697 17.7061 16.7253 19.021 16.7253 20.3922C16.7253 21.7635 17.2697 23.0784 18.2393 24.048C19.2089 25.0176 20.524 25.562 21.895 25.562ZM30.1624 31.7676C30.1624 33.8395 30.1624 33.8395 21.895 33.8395C13.6277 33.8395 13.6277 33.8395 13.6277 31.7676C13.6277 29.1817 17.3309 27.078 21.895 27.078C26.4591 27.078 30.1624 29.1817 30.1624 31.7676Z"
                            fill="var(--vibes-button-icon-fill)"
                          />
                        </svg>
                      </div>
                    </div>
                    <span>Logout</span>
                  </div>
                </button>

                {/* Remix Button */}
                <button
                  data-action="remix"
                  data-variant="red"
                  data-has-icon
                  type="button"
                >
                  <div data-content-wrapper>
                    <div data-icon-container>
                      <div data-icon>
                        <svg
                          width="45"
                          height="45"
                          viewBox="0 0 44 44"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="22"
                            cy="22"
                            r="22"
                            fill="var(--vibes-button-icon-bg)"
                          />
                          <path
                            d="M27.3889 13.2222L30.7778 16.6111M30.7778 16.6111L27.3889 20M30.7778 16.6111H18.5556C17.6558 16.6111 16.7929 16.9686 16.1552 17.6063C15.5175 18.244 15.1601 19.1069 15.1601 20.0067V21.7044M16.6111 30.7778L13.2222 27.3889M13.2222 27.3889L16.6111 24M13.2222 27.3889L25.4445 27.3889C26.3442 27.3889 27.2071 27.0314 27.8448 26.3937C28.4825 25.756 28.84 24.8931 28.84 23.9933L28.84 22.2956"
                            stroke="var(--vibes-button-icon-fill)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <span>Remix</span>
                  </div>
                </button>

                {/* Invite Button */}
                <button
                  data-action="invite"
                  data-variant="yellow"
                  data-has-icon
                  type="button"
                >
                  <div data-content-wrapper>
                    <div data-icon-container>
                      <div data-icon>
                        <svg
                          width="45"
                          height="45"
                          viewBox="0 0 44 44"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="22"
                            cy="22"
                            r="22"
                            fill="var(--vibes-button-icon-bg)"
                          />
                          <path
                            d="M19.1262 23.3156C20.2853 23.3156 21.3969 22.8551 22.2166 22.0354C23.0362 21.2157 23.4967 20.1041 23.4967 18.9451C23.4967 17.786 23.0362 16.6744 22.2166 15.8547C21.3969 15.0351 20.2853 14.5745 19.1262 14.5745C17.9672 14.5745 16.8556 15.0351 16.0359 15.8547C15.2162 16.6744 14.7557 17.786 14.7557 18.9451C14.7557 20.1041 15.2162 21.2157 16.0359 22.0354C16.8556 22.8551 17.9672 23.3156 19.1262 23.3156ZM26.1148 23.3156C26.9589 23.3156 27.7685 22.9804 28.3651 22.3838C28.9617 21.7872 29.2968 20.9776 29.2968 20.1335C29.2968 19.2895 28.9617 18.4799 28.3651 17.8832C27.7685 17.2866 26.9589 16.9515 26.1148 16.9515M11.9328 30.3042C11.9328 27.3327 15.1575 24.9222 19.1262 24.9222C23.095 24.9222 26.3197 27.3327 26.3197 30.3042M29.2968 25.7255C31.2891 26.2717 32.8082 27.7629 32.8082 29.5009"
                            stroke="var(--vibes-button-icon-fill)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <span>Invite</span>
                  </div>
                </button>

                {/* Home Button */}
                <button
                  data-action="home"
                  data-variant="gray"
                  data-has-icon
                  type="button"
                >
                  <div data-content-wrapper>
                    <div data-icon-container>
                      <div data-icon>
                        <svg
                          width="45"
                          height="45"
                          viewBox="0 0 44 44"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="22"
                            cy="22"
                            r="22"
                            fill="var(--vibes-button-icon-bg)"
                          />
                          <path
                            d="M22.6107 12.5279C22.4369 12.3756 22.2139 12.2915 21.9831 12.2915C21.7523 12.2915 21.5293 12.3756 21.3555 12.5279L12.3887 20.3792C12.2947 20.4616 12.2189 20.563 12.166 20.6768C12.1131 20.7906 12.0843 20.9143 12.0815 21.0399C12.0787 21.1655 12.1019 21.2904 12.1497 21.4064C12.1974 21.5224 12.2686 21.627 12.3588 21.7135C12.449 21.8 12.5564 21.8666 12.6743 21.9093C12.7922 21.9521 12.9179 21.9699 13.0432 21.9618C13.1686 21.9537 13.2909 21.9197 13.4024 21.862C13.5138 21.8043 13.612 21.7242 13.6905 21.6266L14.0788 21.2869V29.6111C14.0788 29.9844 14.2271 30.3424 14.4911 30.6064C14.7551 30.8704 15.1131 31.0186 15.4863 31.0186H18.6527C18.9065 31.0186 19.1499 30.9178 19.3294 30.7382C19.509 30.5587 19.6098 30.3152 19.6098 30.0615V25.8379C19.6098 25.5842 19.7106 25.3408 19.8901 25.1612C20.0697 24.9817 20.3131 24.8809 20.5669 24.8809H23.3992C23.6529 24.8809 23.8964 24.9817 24.0759 25.1612C24.2555 25.3408 24.3563 25.5842 24.3563 25.8379V30.0615C24.3563 30.3152 24.4571 30.5587 24.6366 30.7382C24.8162 30.9178 25.0596 31.0186 25.3133 31.0186H28.4798C28.8531 31.0186 29.211 30.8704 29.4751 30.6064C29.7391 30.3424 29.8873 29.9844 29.8873 29.6111V21.2869L30.2756 21.6266C30.4406 21.7631 30.6507 21.8305 30.8631 21.8155C31.0755 21.8004 31.2737 21.7041 31.4177 21.5459C31.5616 21.3877 31.6397 21.1803 31.6356 20.9674C31.6315 20.7545 31.5455 20.5503 31.3954 20.3978L22.6107 12.5279Z"
                            fill="var(--vibes-button-icon-fill)"
                          />
                        </svg>
                      </div>
                    </div>
                    <span>Home</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Mutate mode - Fresh Start, Remix Code, Back (hidden by default) */}
          <div data-panel-mode="mutate" data-mode-hidden>
            <div data-label-container>
              <div data-label data-disappear>
                <span>Remix</span>
              </div>
              <div data-button-wrapper>
                {/* Fresh Start Button */}
                <button
                  data-action="fresh-start"
                  data-variant="blue"
                  data-has-icon
                  type="button"
                >
                  <div data-content-wrapper>
                    <div data-icon-container>
                      <div data-icon>
                        <svg
                          width="45"
                          height="45"
                          viewBox="0 0 44 44"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="22"
                            cy="22"
                            r="22"
                            fill="var(--vibes-button-icon-bg)"
                          />
                          <path
                            d="M27.3889 13.2222L30.7778 16.6111M30.7778 16.6111L27.3889 20M30.7778 16.6111H18.5556C17.6558 16.6111 16.7929 16.9686 16.1552 17.6063C15.5175 18.244 15.1601 19.1069 15.1601 20.0067V21.7044M16.6111 30.7778L13.2222 27.3889M13.2222 27.3889L16.6111 24M13.2222 27.3889L25.4445 27.3889C26.3442 27.3889 27.2071 27.0314 27.8448 26.3937C28.4825 25.756 28.84 24.8931 28.84 23.9933L28.84 22.2956"
                            stroke="var(--vibes-button-icon-fill)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <span>Fresh Start</span>
                  </div>
                </button>

                {/* Remix Code Button */}
                <button
                  data-action="remix-code"
                  data-variant="red"
                  data-has-icon
                  type="button"
                >
                  <div data-content-wrapper>
                    <div data-icon-container>
                      <div data-icon>
                        <svg
                          width="45"
                          height="45"
                          viewBox="0 0 44 44"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="22"
                            cy="22"
                            r="22"
                            fill="var(--vibes-button-icon-bg)"
                          />
                          <path
                            d="M27.3889 13.2222L30.7778 16.6111M30.7778 16.6111L27.3889 20M30.7778 16.6111H18.5556C17.6558 16.6111 16.7929 16.9686 16.1552 17.6063C15.5175 18.244 15.1601 19.1069 15.1601 20.0067V21.7044M16.6111 30.7778L13.2222 27.3889M13.2222 27.3889L16.6111 24M13.2222 27.3889L25.4445 27.3889C26.3442 27.3889 27.2071 27.0314 27.8448 26.3937C28.4825 25.756 28.84 24.8931 28.84 23.9933L28.84 22.2956"
                            stroke="var(--vibes-button-icon-fill)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <span>Remix Code</span>
                  </div>
                </button>

                {/* Back Button */}
                <button
                  data-action="back"
                  data-variant="yellow"
                  data-has-icon
                  type="button"
                >
                  <div data-content-wrapper>
                    <div data-icon-container>
                      <div data-icon>
                        <svg
                          width="45"
                          height="45"
                          viewBox="0 0 44 44"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="22"
                            cy="22"
                            r="22"
                            fill="var(--vibes-button-icon-bg)"
                          />
                          <path
                            d="M25.5 14L17.5 22L25.5 30"
                            stroke="var(--vibes-button-icon-fill)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <span>Back</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Invite mode - Email form, status, Back (hidden by default) */}
          <div data-panel-mode="invite" data-mode-hidden>
            <div data-label-container data-label-yellow>
              <div data-label data-disappear>
                <span>Invite</span>
              </div>
              <div data-button-wrapper>
                <form data-invite-form action="/invite" method="GET">
                  <input type="hidden" name="db" id="vibe-db" value="" />
                  <input type="hidden" name="vibe" id="vibe-vibe" value="" />
                  <input type="hidden" name="group" id="vibe-group" value="" />

                  <label htmlFor="vibe-invite-email">Invite by email</label>
                  <input
                    id="vibe-invite-email"
                    type="email"
                    name="email"
                    placeholder="friend@example.com"
                    autoComplete="email"
                    required
                  />
                  <button type="submit" data-variant="blue">
                    Send Invite
                  </button>
                </form>

                <div data-invite-status style={{ display: "none" }}>
                  {/* Status text updated by JavaScript */}
                </div>

                {/* Back Button */}
                <button
                  data-action="back"
                  data-variant="yellow"
                  data-has-icon
                  type="button"
                >
                  <div data-content-wrapper>
                    <div data-icon-container>
                      <div data-icon>
                        <svg
                          width="45"
                          height="45"
                          viewBox="0 0 44 44"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="22"
                            cy="22"
                            r="22"
                            fill="var(--vibes-button-icon-bg)"
                          />
                          <path
                            d="M25.5 14L17.5 22L25.5 30"
                            stroke="var(--vibes-button-icon-fill)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <span>Back</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline styles for self-contained component */}

      {/* Vanilla JavaScript for interactivity */}
      <script
        type="module"
        src="/dist/vibes.diy/pkg/serve/vibes-controls/scripts.js"
      />
    </>
  );
}
