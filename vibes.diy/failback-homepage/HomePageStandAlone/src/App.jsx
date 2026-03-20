import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AnimatedScene } from "./animated-scene/AnimatedScene.tsx";
import { TerminalDemo } from "./animated-scene/TerminalDemo.tsx";
import { ChatAnimation } from "./animated-scene/ChatAnimation.tsx";

/* ═══ DATA ═══ */
const scenarios = [
  { title: 'JChris named the conversation "Friendsgiving 2: Mac n Cheese Redemption"', messages: [
    { user: "JChris", text: "Who's coming to Friendsgiving this year?" },
    { user: "Megan", text: "yes please rescue me from my family 🥲" },
    { user: "JChris", text: "can we not repeat last year's mac n cheese disaster tho" },
    { user: "Megan", text: "I'm still recovering!" },
    { user: "Mike", text: "Should I make a spreadsheet?" },
    { user: "Megan", text: "Zzzzzzzzz" },
    { user: "You", text: "buds I got this!" },
    { user: "You", text: "lemme just make us a festive lil app:" },
    { user: "You", text: "https://bright-shango-4087.vibesdiy.app/" },
    { user: "JChris", text: "nice! dibs on the mac" },
    { user: "Marcus", text: "I'm a *coder* now\n*tries Vibes DIY once* 🤓" },
  ]},
  { title: "Roomies", messages: [
    { user: "James", text: "sorry roomies, I didn't have time to tackle Dish Mountain last night" },
    { user: "James", text: "will absolutely get to it after work" },
    { user: "Lola", text: "Pretty sure it's my turn, no?" },
    { user: "Jordan", text: "Huge if true!!" },
    { user: "James", text: "@Lola if you do the dishes I'll take out the trash tomorrow AM!" },
    { user: "You", text: "ok hear me out:" },
    { user: "You", text: "chore chart, but make it fun?" },
    { user: "You", text: "https://coltrane-oshun-9477.vibesdiy.app/" },
    { user: "Jordan", text: "Did we just…solve dishes?" },
    { user: "James", text: "Chore quest!!!" },
  ]},
  { title: "Trivia Night", messages: [
    { user: "Bobby", text: "never felt dumber than last night 🥲" },
    { user: "Bobby", text: "they should make trivia night for people with brainrot" },
    { user: "You", text: '"I\'ll take Real Housewives of SLC for $500, Alex!"' },
    { user: "Lindsay", text: "Bravo Brainteasters lol" },
    { user: "Nikki", text: "to be fair, the reality TV lore is deeeeeep" },
    { user: "Lindsay", text: "actually I'd probably watch that" },
    { user: "Bobby", text: "imagine Andy Cohen as a host" },
    { user: "You", text: "I kinda think you might have something with this:\nhttps://chromatic-fader-4248.vibesdiy.app/" },
    { user: "Bobby", text: "oh it's so over for all of you!!!!" },
  ]},
];

/* ═══ VIBES SWITCH SVG ═══ */
// switchColors matching original: primary = var(--vibes-black), secondary = var(--vibes-white)
const switchColors = { primary: "var(--vibes-black)", secondary: "var(--vibes-white)" };

function VibesSwitch({ size = 24, className }) {
  const [active, setActive] = React.useState(true);

  const originalD = `M426.866,285.985c-7.999-0.416-19.597-0.733-31.141-1.687  c-15.692-1.297-28.809-8.481-40.105-19.104c-12.77-12.008-20.478-26.828-22.714-44.177c-3.048-23.644,3.384-44.558,19.646-62.143  c9.174-9.92,20.248-17.25,33.444-20.363c7.786-1.837,15.944-2.399,23.973-2.828c9.988-0.535,20.023-0.666,30.021-0.371  c10.191,0.301,20.433,0.806,30.521,2.175c12.493,1.696,23.132,7.919,32.552,16.091c14.221,12.337,22.777,27.953,25.184,46.594  c2.822,21.859-2.605,41.617-16.777,58.695c-9.494,11.441-21.349,19.648-35.722,23.502c-6.656,1.785-13.724,2.278-20.647,2.77  C446.914,285.721,438.682,285.667,426.866,285.985z`;

  const stretchedD = `M165.866,285.985c-7.999-0.416-19.597-0.733-31.141-1.687  c-15.692-1.297-28.809-8.481-40.105-19.104c-12.77-12.008-20.478-26.828-22.714-44.177c-3.048-23.644,3.384-44.558,19.646-62.143  c9.174-9.92,20.248-17.25,33.444-20.363c7.786-1.837,15.944-2.399,23.973-2.828c9.988-0.535,121.023-0.666,131.021-0.371  c10.191,0.301,20.433,0.806,30.521,2.175c12.493,1.696,23.132,7.919,32.552,16.091c14.221,12.337,22.777,27.953,25.184,46.594  c2.822,21.859-2.605,41.617-16.777,58.695c-9.494,11.441-21.349,19.648-35.722,23.502c-6.656,1.785-13.724,2.278-20.647,2.77  C286.914,285.721,177.682,285.667,165.866,285.985z`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={size}
      viewBox="0 60 600 300"
      fill="currentColor"
      className={className}
      onClick={() => setActive(!active)}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#000"
        d="M293.353,298.09c-41.038,0-82.078,0.125-123.115-0.077  c-11.993-0.06-24.011-0.701-35.964-1.703c-15.871-1.331-29.73-7.937-41.948-17.946c-16.769-13.736-27.207-31.417-30.983-52.7  c-4.424-24.93,1.404-47.685,16.506-67.913c11.502-15.407,26.564-26.1,45.258-30.884c7.615-1.949,15.631-2.91,23.501-3.165  c20.08-0.652,40.179-0.853,60.271-0.879c69.503-0.094,139.007-0.106,208.51,0.02c14.765,0.026,29.583,0.097,44.28,1.313  c36.984,3.059,61.78,23.095,74.653,57.301c17.011,45.199-8.414,96.835-54.29,111.864c-7.919,2.595-16.165,3.721-24.434,3.871  c-25.614,0.467-51.234,0.742-76.853,0.867C350.282,298.197,321.817,298.09,293.353,298.09z"
      />
      <path
        fill="#fff"
        fillRule="evenodd"
        clipRule="evenodd"
        d={active ? stretchedD : originalD}
        style={{
          transition: "d 0.3s ease, transform 0.8s ease, fill 2s ease",
          transform: active ? "translateX(3px) " : "none",
        }}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 0.5s ease",
          fill: active ? switchColors.primary : switchColors.secondary,
        }}
        d="M181.891,205.861c0-5.043-0.001-10.086,0-15.129  c0.001-5.046,1.679-7.539,6.606-7.695c9.292-0.294,18.653-1.051,27.888,0.707c7.614,1.449,11.523,5.954,11.902,13.446  c0.066,1.312-0.313,2.752-0.857,3.966c-1.401,3.123-1.399,6.266-0.673,9.507c0.301,1.342,0.443,2.723,0.787,4.053  c1.274,4.925-1.78,10.114-6.085,11.937c-3.111,1.318-6.561,2.327-9.909,2.497c-7.303,0.37-14.639,0.136-21.96,0.101  c-1.165-0.005-2.345-0.181-3.488-0.422c-2.657-0.56-4.162-2.962-4.197-6.801C181.854,216.639,181.891,211.25,181.891,205.861z   M204.442,192.385c-2.757,0-5.514,0-8.271,0c-3.695,0-5.151,1.669-4.712,5.403c0.369,3.14,1.05,3.735,4.225,3.737  c5.024,0.004,10.05,0.109,15.07-0.014c2.028-0.05,4.167-0.27,6.04-0.98c3.182-1.207,3.639-4.256,1.008-6.455  c-1.073-0.896-2.659-1.509-4.06-1.618C210.659,192.22,207.544,192.385,204.442,192.385z M204.334,211.104c0,0.045,0,0.091,0,0.137  c-3.101,0-6.203-0.055-9.302,0.037c-0.823,0.024-2.257,0.373-2.344,0.794c-0.447,2.154-0.959,4.444-0.639,6.563  c0.276,1.822,2.447,1.451,3.882,1.441c5.989-0.042,11.98-0.118,17.961-0.385c1.416-0.063,2.859-0.79,4.176-1.441  c1.79-0.886,1.833-2.475,1.029-4.046c-1.166-2.276-3.297-3.024-5.677-3.081C210.394,211.049,207.363,211.104,204.334,211.104z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 0.8s ease",
          fill: active ? switchColors.primary : switchColors.secondary,
        }}
        d="M291.409,229.748c-3.621-0.394-7.838-0.587-11.94-1.379  c-3.577-0.69-6.343-2.991-8.213-6.163c-1.763-2.99-0.301-5.6,3.139-5.292c2.287,0.205,4.512,1.129,6.758,1.755  c6.281,1.751,12.643,1.892,19.053,0.951c0.667-0.098,1.31-0.416,1.941-0.686c1.502-0.644,2.55-1.682,2.581-3.415  c0.031-1.74-1.195-2.749-2.579-3.132c-2.298-0.637-4.688-1.021-7.065-1.273c-5.062-0.536-10.252-0.401-15.187-1.475  c-9.677-2.105-11.678-10.53-10.101-16.009c1.62-5.625,5.911-8.92,11.318-9.73c8.388-1.257,16.925-1.491,25.279,0.654  c3.702,0.951,6.615,3.072,7.883,6.931c0.918,2.792-0.332,4.6-3.268,4.357c-1.684-0.139-3.367-0.676-4.974-1.248  c-6.711-2.387-13.572-2.897-20.569-1.783c-1.001,0.159-2.146,0.414-2.875,1.034c-0.901,0.766-2.016,1.981-1.98,2.964  c0.041,1.128,0.995,2.733,1.991,3.206c1.81,0.857,3.925,1.279,5.948,1.441c5.152,0.41,10.356,0.296,15.479,0.905  c7.98,0.949,13.779,9.833,11.241,17.125c-1.959,5.628-6.44,8.489-12.143,9.322C299.455,229.344,295.715,229.419,291.409,229.748z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 1.2s ease",
          fill: active ? switchColors.primary : switchColors.secondary,
        }}
        d="M235.786,208.14c0-6.905-0.01-13.809,0.004-20.714  c0.007-3.474,0.948-4.428,4.415-3.758c6.62,1.279,13.232,2.651,19.759,4.331c1.7,0.438,3.404,1.896,4.515,3.341  c1.777,2.31,0.433,5.367-2.463,5.745c-1.86,0.243-3.819-0.138-5.717-0.368c-2.183-0.264-4.339-0.783-6.525-0.976  c-1.572-0.138-3.065,0.375-3.8,1.959c-0.76,1.638-0.319,3.329,0.942,4.34c1.619,1.296,3.522,2.327,5.447,3.128  c2.146,0.894,4.539,1.207,6.66,2.145c1.446,0.64,2.982,1.687,3.786,2.981c0.689,1.11,0.928,3.094,0.378,4.202  c-0.492,0.991-2.32,1.795-3.579,1.825c-2.238,0.052-4.483-0.652-6.741-0.832c-1.614-0.127-3.333-0.203-4.865,0.212  c-2.574,0.699-3.225,3.013-1.719,5.218c1.396,2.044,3.431,3.141,5.757,3.761c2.791,0.744,5.637,1.315,8.373,2.222  c3.19,1.058,4.791,3.496,4.801,6.723c0.011,3.365-1.759,5.021-5.138,4.424c-4.402-0.778-8.759-1.81-13.134-2.735  c-2.357-0.499-4.718-0.981-7.069-1.511c-3.263-0.737-4.132-1.805-4.141-5.154c-0.019-6.836-0.006-13.672-0.006-20.508  C235.747,208.141,235.766,208.14,235.786,208.14z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 0.6s ease",
          fill: active ? switchColors.primary : switchColors.secondary,
        }}
        d="M135.138,229.842c-2.941-0.084-5.296-1.462-6.684-3.9  c-1.827-3.21-3.328-6.618-4.81-10.011c-3.55-8.128-7.021-16.291-10.486-24.455c-0.48-1.132-0.902-2.329-1.087-3.536  c-0.417-2.72,1.238-4.585,3.938-4.119c1.591,0.275,3.569,0.98,4.45,2.173c2.226,3.015,4.175,6.299,5.784,9.69  c2.208,4.654,3.898,9.552,6.032,14.244c0.628,1.379,2.009,2.416,3.045,3.609c0.892-1.159,2.042-2.201,2.63-3.498  c2.697-5.953,5.22-11.985,7.841-17.974c1.423-3.252,3.089-6.418,6.532-7.905c1.238-0.535,3.012-0.712,4.184-0.214  c0.81,0.344,1.377,2.126,1.385,3.271c0.009,1.458-0.479,2.997-1.059,4.371c-4.227,10.013-8.504,20.005-12.833,29.974  c-0.79,1.819-1.762,3.589-2.875,5.229C139.73,228.848,137.671,229.894,135.138,229.842z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 1.3s ease",
          fill: active ? switchColors.primary : switchColors.secondary,
        }}
        d="M164.636,206.263c0-6.691,0.054-13.383-0.036-20.073  c-0.024-1.851,0.716-2.67,2.449-2.81c0.274-0.022,0.549-0.054,0.823-0.076c5.488-0.445,6.091,0.105,6.091,5.562  c0,12.348,0,24.695,0,37.043c0,2.887-0.354,3.405-3.222,3.618c-1.628,0.121-3.338-0.001-4.91-0.408  c-0.593-0.153-1.265-1.408-1.278-2.171c-0.096-5.584-0.034-11.172-0.022-16.759c0.002-1.308,0-2.617,0-3.926  C164.566,206.263,164.601,206.263,164.636,206.263z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 1s ease",
          fill: active ? switchColors.secondary : switchColors.primary,
        }}
        d="M388.313,210.147c0-6.356,0.034-12.713-0.023-19.069  c-0.015-1.61,0.359-2.472,2.19-2.346c2.887,0.198,5.809,0.045,8.671,0.398c4.396,0.542,8.019,4.294,8.144,8.904  c0.223,8.142,0.265,16.304-0.074,24.439c-0.248,5.945-4.552,9.662-10.491,9.831c-1.999,0.057-4.003-0.081-6.006-0.09  c-1.746-0.008-2.439-0.853-2.428-2.584C388.34,223.136,388.313,216.642,388.313,210.147z M393.418,210.324c-0.037,0-0.075,0-0.114,0  c0,4.55-0.038,9.101,0.015,13.65c0.031,2.688,0.926,3.439,3.56,3.239c3.273-0.248,5.493-2.511,5.534-6.04  c0.082-7.099,0.054-14.2-0.033-21.299c-0.041-3.268-1.739-5.241-4.87-6.092c-2.68-0.728-4.025,0.161-4.07,2.896  C393.364,201.226,393.418,205.775,393.418,210.324z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 1s ease",
          fill: active ? switchColors.secondary : switchColors.primary,
        }}
        d="M478.079,200.8c0.674-1.566,1.121-2.53,1.506-3.519  c0.673-1.73,1.252-3.5,1.981-5.205c0.315-0.737,0.766-1.654,1.407-1.961c1.094-0.523,2.388-0.63,3.598-0.912  c0.205,1.142,0.798,2.381,0.537,3.404c-0.606,2.388-1.448,4.756-2.507,6.984c-3.981,8.389-4.352,17.254-3.78,26.282  c0.091,1.438,0.031,2.899-0.105,4.335c-0.14,1.473-0.989,2.428-2.542,2.497c-1.514,0.067-2.311-0.903-2.54-2.23  c-0.232-1.348-0.394-2.754-0.277-4.108c0.94-10.972-1.116-21.38-5.626-31.375c-0.586-1.298-0.899-2.762-1.093-4.183  c-0.233-1.712,0.825-2.592,2.379-1.843c1.164,0.561,2.345,1.55,2.973,2.657c1.078,1.897,1.712,4.043,2.568,6.07  C476.918,198.547,477.37,199.361,478.079,200.8z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 1s ease",
          fill: active ? switchColors.secondary : switchColors.primary,
        }}
        d="M440.516,210.627c0,6.281,0.007,12.563-0.004,18.844  c-0.004,2.067-0.805,3.038-2.531,3.015c-1.877-0.025-2.365-1.136-2.359-2.876c0.046-12.631,0.019-25.263,0.029-37.895  c0.002-2.592,0.525-3.205,2.419-3.148c1.856,0.057,2.479,1.03,2.466,2.803C440.484,197.788,440.515,204.208,440.516,210.627z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 1s ease",
          fill: active ? switchColors.secondary : switchColors.primary,
        }}
        d="M416.875,210.721c0.068-3.305,1.849-5.306,4.727-5.309  c2.765-0.003,4.924,2.404,4.816,5.371c-0.106,2.956-2.355,5.212-5.12,5.138C418.626,215.849,416.813,213.718,416.875,210.721z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        style={{
          transition: "fill 1s ease",
          fill: active ? switchColors.secondary : switchColors.primary,
        }}
        d="M449.933,210.636c0.102-3.331,1.886-5.279,4.778-5.22  c2.67,0.055,4.829,2.432,4.762,5.243c-0.073,3.021-2.404,5.36-5.242,5.261C451.606,215.829,449.84,213.657,449.933,210.636z"
      />
    </svg>
  );
}


function MoonIcon(){return <svg width={35} height={35} viewBox="0 0 31.82 31.82" xmlns="http://www.w3.org/2000/svg"><g><path fill="var(--vibes-cream)" d="M16.06,25.28c-1.25,0-2.43-.23-3.53-.7s-2.06-1.12-2.89-1.95-1.48-1.8-1.95-2.89c-.47-1.09-.71-2.27-.71-3.52s.24-2.45.72-3.55,1.14-2.08,1.99-2.92c.85-.84,1.84-1.49,2.95-1.95.15-.06.31-.1.48-.1.36,0,.55.18.55.53,0,.11-.03.23-.08.37-.21.54-.38,1.09-.5,1.66s-.18,1.14-.18,1.7c0,1.52.31,2.85.94,3.98.63,1.13,1.52,2.01,2.67,2.62,1.15.62,2.51.92,4.08.92.54,0,1.05-.05,1.53-.14s.9-.18,1.25-.28c.11-.03.2-.06.27-.08s.14-.03.21-.03c.14,0,.27.05.38.16s.17.24.17.4c0,.04,0,.11-.02.2s-.04.18-.08.28c-.43.95-1.04,1.83-1.84,2.64s-1.75,1.45-2.84,1.93-2.28.72-3.57.72Z"/><path fill="#231F20" d="M15.91,31.82c-2.19,0-4.25-.41-6.18-1.24-1.92-.83-3.61-1.97-5.07-3.43s-2.6-3.15-3.42-5.07c-.83-1.92-1.24-3.97-1.24-6.17s.41-4.25,1.24-6.18c.83-1.92,1.97-3.61,3.42-5.07,1.46-1.46,3.15-2.6,5.07-3.42s3.98-1.24,6.18-1.24,4.25.41,6.18,1.24,3.61,1.97,5.07,3.42,2.6,3.15,3.42,5.07c.83,1.92,1.24,3.98,1.24,6.18s-.41,4.25-1.24,6.17c-.83,1.92-1.97,3.61-3.42,5.07-1.46,1.46-3.15,2.6-5.07,3.43-1.92.83-3.98,1.24-6.18,1.24ZM16.07,25.28c1.28,0,2.46-.24,3.56-.73s2.04-1.13,2.85-1.93c.81-.8,1.42-1.68,1.85-2.64.04-.1.07-.2.08-.29s.02-.15.02-.19c0-.17-.06-.3-.17-.41s-.24-.16-.37-.16c-.06,0-.13.01-.21.03s-.17.05-.27.08c-.35.09-.77.19-1.26.28s-.99.14-1.52.14c-1.57,0-2.93-.31-4.08-.93s-2.04-1.49-2.68-2.62c-.63-1.13-.95-2.46-.95-3.99,0-.56.06-1.13.18-1.69s.29-1.12.51-1.66c.05-.16.08-.28.08-.37,0-.17-.05-.3-.16-.39s-.23-.14-.39-.14c-.18,0-.34.03-.48.09-1.11.47-2.1,1.12-2.95,1.96s-1.52,1.81-2,2.92c-.48,1.11-.72,2.29-.72,3.55s.24,2.42.71,3.53,1.13,2.07,1.96,2.9,1.8,1.48,2.89,1.95,2.27.7,3.53.7Z"/></g></svg>}
function SunIcon(){const f="var(--vibes-cream)",b="#231F20";return <svg width={35} height={35} viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg"><g><circle cx="45" cy="45" r="45" fill={b}/><g transform="translate(45,45) scale(0.75) translate(-45,-45)"><path fill={f} d="M45 68c-12.682 0-23-10.317-23-23 0-12.682 10.318-23 23-23 12.683 0 23 10.318 23 23C68 57.683 57.683 68 45 68z"/><path fill={f} d="M38.652 17.61c-.292 0-.573-.127-.765-.356-.239-.284-.301-.677-.161-1.021l6.348-15.61C44.227.247 44.593 0 45 0s.773.247.926.623l6.349 15.61c.14.344.077.737-.162 1.021-.238.284-.616.414-.978.333-4.045-.881-8.228-.881-12.271 0-.07.016-.141.023-.212.023z"/><path fill={f} d="M45 90c-.407 0-.773-.246-.926-.623l-6.348-15.61c-.14-.344-.078-.737.161-1.021.239-.284.615-.412.978-.333 4.043.882 8.226.882 12.271 0 .363-.08.74.05.978.333.239.283.302.677.162 1.021l-6.349 15.61C45.773 89.754 45.407 90 45 90z"/><path fill={f} d="M16.61 52.349c-.127 0-.255-.024-.377-.073l-15.61-6.349C.247 45.773 0 45.407 0 45s.247-.773.624-.926l15.61-6.348c.343-.14.737-.078 1.021.161.284.239.412.616.333.978-.441 2.021-.665 4.086-.665 6.135 0 2.049.224 4.113.665 6.136.079.362-.049.739-.333.978-.183.155-.412.235-.644.235z"/><path fill={f} d="M73.39 52.349c-.231 0-.461-.08-.644-.235-.284-.238-.412-.615-.333-.978.44-2.022.664-4.087.664-6.136 0-2.049-.224-4.114-.664-6.135-.079-.362.049-.739.333-.978.283-.239.676-.301 1.021-.161l15.61 6.348C89.754 44.227 90 44.593 90 45s-.246.773-.623.926l-15.61 6.349c-.122.049-.25.074-.377.074z"/><path fill={f} d="M20.437 30.415c-.028 0-.057-.001-.085-.004-.37-.032-.692-.266-.836-.607l-6.549-15.527c-.158-.375-.073-.808.214-1.096.288-.288.722-.371 1.096-.214l15.527 6.549c.342.144.576.466.607.835.032.37-.144.727-.456.927-1.743 1.119-3.36 2.42-4.809 3.868-1.448 1.449-2.75 3.066-3.868 4.809-.185.288-.503.46-.841.46z"/><path fill={f} d="M76.112 77.112c-.131 0-.263-.025-.389-.078l-15.526-6.549c-.342-.145-.576-.467-.607-.836-.032-.37.144-.727.456-.928 1.745-1.121 3.363-2.423 4.808-3.868l0 0c1.445-1.444 2.747-3.063 3.868-4.808.201-.312.553-.489.928-.456.369.031.691.266.836.607l6.549 15.526c.157.375.073.809-.215 1.096-.192.193-.448.294-.708.294z"/><path fill={f} d="M69.563 30.414c-.339 0-.656-.171-.842-.459-1.121-1.746-2.423-3.363-3.868-4.809l0 0c-1.447-1.447-3.065-2.749-4.808-3.868-.313-.2-.488-.557-.456-.927.031-.37.266-.691.607-.835l15.526-6.549c.373-.158.808-.074 1.096.214.288.288.372.721.215 1.096l-6.549 15.527c-.145.342-.467.576-.836.607-.028.003-.057.004-.085.004z"/><path fill={f} d="M13.887 77.112c-.26 0-.516-.102-.707-.293-.288-.288-.373-.721-.214-1.096l6.549-15.526c.144-.342.466-.576.835-.607.37-.043.727.144.927.456 1.119 1.742 2.421 3.36 3.868 4.808l0 0c1.446 1.446 3.063 2.747 4.809 3.868.312.201.488.558.456.928-.032.369-.266.691-.607.836l-15.527 6.549c-.126.053-.257.077-.389.077z"/></g></g></svg>}

/* ═══ HOOKS ═══ */
function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return m;
}

function linkify(t) {
  return t.split(/(https?:\/\/[^\s]+)/g).map((p,i) =>
    p.match(/^https?:\/\//) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{color:"inherit",textDecoration:"underline",cursor:"pointer"}}>{p}</a>
    : p.includes("\n") ? p.split("\n").map((l,j) => <React.Fragment key={j}>{j>0&&<br/>}{l}</React.Fragment>) : p
  );
}

/* ═══ DRAGGABLE CARD (exact from original) ═══ */
const cardBg    = { yellow:"#FEDD00", red:"#DA291C", blue:"#009ACE", grey:"#C3C3C1" };
const cardText  = { yellow:"#000000", red:"#ffffff", blue:"#ffffff", grey:"#ffffff" };
const cardBdr   = { yellow:"#FDC000", red:"#9F0100", blue:"#003886", grey:"#000000" };
const cardTitleBg = { yellow:"#FEDD009b", red:"#DA291C9b", blue:"#009ACE9b", grey:"#C3C3C19b" };
const cardTitleBdr = { yellow:"#FCA600", red:"#7F0100", blue:"#002D6A", grey:"#000000" };

function DraggableCard({ color="grey", x=0, y=0, isText=false, children }) {
  const ref = useRef(null);
  const isMobile = useIsMobile();
  const [dragging, setDragging] = useState(false);
  const start = useRef({x:0,y:0});
  const pos = useRef({x,y});

  useEffect(() => {
    if (!isMobile && ref.current) ref.current.style.transform = `translate(${x}px,${y}px)`;
    else if (isMobile && ref.current) ref.current.style.transform = "";
  }, [x,y,isMobile]);

  useEffect(() => {
    if (!isMobile && dragging) {
      const move = e => { const r = ref.current?.parentElement?.getBoundingClientRect(); if(!r)return; pos.current={x:e.clientX-r.left-start.current.x,y:e.clientY-r.top-start.current.y}; if(ref.current) ref.current.style.transform=`translate(${pos.current.x}px,${pos.current.y}px)`; };
      const up = () => setDragging(false);
      document.addEventListener("mousemove",move); document.addEventListener("mouseup",up);
      return()=>{document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",up);};
    }
  }, [dragging,isMobile]);

  const onDown = e => { if(isMobile)return; e.preventDefault(); setDragging(true); const r=ref.current?.getBoundingClientRect(); if(r) start.current={x:e.clientX-r.left,y:e.clientY-r.top}; };

  const style = isMobile
    ? { marginBottom:16, width: isText?"100%":"fit-content", border:`1px solid ${cardBdr[color]}`, boxShadow:"0 2px 4px rgba(0,0,0,0.1)" }
    : { position:"absolute", cursor:dragging?"grabbing":"grab", userSelect:"none", zIndex:dragging?1000:1, border:`1px solid ${cardBdr[color]}`, boxShadow:"0 2px 4px rgba(0,0,0,0.1)" };

  return (
    <div ref={ref} style={style} onMouseDown={isMobile?undefined:onDown}>
      <div style={{ height:10, width:"100%", background:cardTitleBg[color], borderBottom:`1px solid ${cardTitleBdr[color]}` }} />
      <div style={{ padding:"16px 8px", background:cardBg[color], color:cardText[color] }}>{children}</div>
    </div>
  );
}

/* ═══ DRAGGABLE SECTION (exact from original) ═══ */
const secTitleBg = { yellow:"#fe9a004d", red:"#960101a8", blue:"#1f0f9866", grey:"#00000066" };

function DraggableSection({ color="grey", x=0, y=0, children, static:isStatic=false, removePaddingTop=false, removeMargin=false }) {
  const ref = useRef(null);
  const isMobile = useIsMobile();
  const [dragging, setDragging] = useState(false);
  const start = useRef({x:0,y:0});

  useEffect(() => {
    if (isStatic) return;
    if (!isMobile && ref.current) ref.current.style.transform = `translate(${x}px,${y}px)`;
    else if (isMobile && ref.current) ref.current.style.transform = "";
  }, [x,y,isMobile,isStatic]);

  useEffect(() => {
    if (!isMobile && dragging && !isStatic) {
      const move = e => { const r=ref.current?.parentElement?.getBoundingClientRect(); if(!r)return; const nx=e.clientX-r.left-start.current.x, ny=e.clientY-r.top-start.current.y; if(ref.current) ref.current.style.transform=`translate(${nx}px,${ny}px)`; };
      const up = () => setDragging(false);
      document.addEventListener("mousemove",move); document.addEventListener("mouseup",up);
      return()=>{document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",up);};
    }
  }, [dragging,isMobile,isStatic]);

  const onDown = e => { if(isMobile||isStatic)return; if(["INPUT","TEXTAREA","BUTTON","A","SELECT"].includes(e.target.tagName)||e.target.closest("a,button"))return; e.preventDefault(); setDragging(true); const r=ref.current?.getBoundingClientRect(); if(r) start.current={x:e.clientX-r.left,y:e.clientY-r.top}; };

  const base = { boxShadow:"0 2px 4px rgba(0,0,0,0.1)", minWidth: isStatic ? "unset" : "500px" };
  let style;
  if (isStatic) {
    style = { ...base, minWidth:"unset", marginBottom:16, width: isMobile ? "100%" : removeMargin ? "100%" : "80%", margin: isMobile ? "0" : removeMargin ? "0" : "0 auto 16px auto" };
  } else if (isMobile) {
    style = { ...base, marginBottom:16, minWidth:"unset" };
  } else {
    style = { ...base, position:"absolute", cursor:dragging?"grabbing":"grab", userSelect:"none", zIndex:dragging?1000:1 };
  }

  return (
    <div ref={ref} style={style} onMouseDown={isMobile||isStatic?undefined:onDown}>
      <div style={{ height:30, width:"100%", background:secTitleBg[color], border:"1px solid black", marginBottom:1, boxShadow:"#ffffff61 0px 0px 0px 1px" }} />
      <div style={{ background:"#FFFFF0", color:"#221f20", border:"1px solid black", boxShadow:"0 0 0 1px white", padding: removePaddingTop ? "0 16px 16px" : 16 }}>{children}</div>
    </div>
  );
}

/* Terminal replaced by original TerminalDemo from animated-scene/TerminalDemo.tsx */

/* ═══ MAIN APP ═══ */
export default function App() {
  const isMobile = useIsMobile();
  const [isDark, setIsDark] = useState(() => { const s=localStorage.getItem("vibes-dark-mode"); return s!==null?s==="true":window.matchMedia("(prefers-color-scheme:dark)").matches; });
  const scenario = useMemo(() => scenarios[Math.floor(Math.random()*scenarios.length)], []);

  // Section refs for dynamic gradient positioning
  const sec0Ref = useRef(null);
  const sec1Ref = useRef(null);
  const sec3Ref = useRef(null);
  const sec5Ref = useRef(null);
  const sec8Ref = useRef(null);
  const secsRef = useRef(null);
  const [refsReady, setRefsReady] = useState(false);
  const [recalc, setRecalc] = useState(0);

  useEffect(() => { document.documentElement.setAttribute("data-theme",isDark?"dark":"light"); localStorage.setItem("vibes-dark-mode",String(isDark)); },[isDark]);

  const [animProgress, setAnimProgress] = useState(0);
  const animScrollRef = useRef(null);       // desktop: scrollable overlay
  const hiddenScrollRef = useRef(null);     // mobile: hidden scroll div

  useEffect(() => { if(sec0Ref.current && sec1Ref.current && sec3Ref.current && sec5Ref.current && sec8Ref.current) setRefsReady(true); },[]);
  useEffect(() => { let t; const h=()=>{clearTimeout(t);t=setTimeout(()=>setRecalc(c=>c+1),300);}; window.addEventListener("resize",h); return()=>{window.removeEventListener("resize",h);clearTimeout(t);}; },[]);

  const scrollContainerRef = useRef(null);
  const mobileAnimRef = useRef(null); // track mobile animation frame

  // Reset progress when switching between mobile/desktop
  useEffect(() => {
    setAnimProgress(0);
  }, [isMobile]);

  // Desktop: scroll handler on animScrollRef (the overlay wrapper)
  useEffect(() => {
    if (isMobile) return;
    // Stop any mobile animation that might be running
    if (mobileAnimRef.current) { cancelAnimationFrame(mobileAnimRef.current); mobileAnimRef.current = null; }
    const el = animScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const progress = scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * 100 : 0;
      setAnimProgress(Math.max(0, Math.min(100, progress)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  // Mobile: auto-animate loop when Section 0 is visible
  useEffect(() => {
    if (!isMobile) {
      // Ensure cleanup when switching to desktop
      if (mobileAnimRef.current) { cancelAnimationFrame(mobileAnimRef.current); mobileAnimRef.current = null; }
      return;
    }
    const section = sec0Ref.current;
    if (!section) return;

    let startTime;
    const duration = 15000;
    let running = false;

    const animate = (timestamp) => {
      if (!running) return;
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) % duration;
      const progress = (elapsed / duration) * 100;
      setAnimProgress(progress);
      mobileAnimRef.current = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true;
        startTime = null;
        mobileAnimRef.current = requestAnimationFrame(animate);
      } else if (!entry.isIntersecting && running) {
        running = false;
        if (mobileAnimRef.current) { cancelAnimationFrame(mobileAnimRef.current); mobileAnimRef.current = null; }
      }
    }, { threshold: 0.1 });

    observer.observe(section);

    return () => {
      running = false;
      observer.disconnect();
      if (mobileAnimRef.current) { cancelAnimationFrame(mobileAnimRef.current); mobileAnimRef.current = null; }
    };
  }, [isMobile]);

  function getAbsTop(el){let t=0,c=el;while(c){t+=c.offsetTop;c=c.offsetParent;}return t;}
  function gradStyle(ref,gradient,extra=0){
    if(!ref.current)return{display:"none"};
    const t=getAbsTop(ref.current),h=ref.current.offsetHeight;
    return{position:"absolute",top:isMobile?t-200:t,left:0,right:0,height:h+(isMobile?300:30)+extra,pointerEvents:"none",background:gradient};
  }

  return (
    /* Outer: fixed black background (exact from getBlackBorderWrapper) */
    <div style={{ width:"100%", height:"100%", position:"fixed", top:0, left:0, right:0, bottom:0, backgroundColor:"black" }}>
      {/* Background layer */}
      <div style={{ position:"fixed", inset:10, borderRadius:10, backgroundColor: isDark ? "#1a1a1a" : "#cccdc8", zIndex:0, transition:"background 0.3s" }} />

      {/* Grid overlay (fixed, above gradients, below content) */}
      <div className="grid-overlay" />

      {/* Inner scrollable wrapper (exact from getBlackBorderInnerWrapper) */}
      <div ref={scrollContainerRef} style={{ height:"calc(100% - 20px)", width:"calc(100% - 20px)", margin:10, borderRadius:10, position:"relative", overflow:"auto", scrollbarWidth:"none", msOverflowStyle:"none" }} className="scroll-hide">

        {/* Navbar (exact from getMenuStyle) */}
        {/* Scrolling gradient backgrounds — INSIDE the scroll container so they scroll with content */}
        {!isDark && <div style={{position:"absolute",top:0,left:0,right:0,width:"100%",minHeight:"100%",zIndex:1,pointerEvents:"none",display:isDark?"none":undefined}}>
          {refsReady && <>
            <div key={`g0-${recalc}`} style={gradStyle(sec0Ref,"linear-gradient(oklch(0.8461 0.0069 115.73),oklch(0.8461 0.0069 115.73))")} />
            <div key={`g1-${recalc}`} style={gradStyle(sec1Ref,"linear-gradient(180deg,oklch(0.8461 0.0069 115.73) 0%,oklch(0.6439 0.1304 231.41) 30%,oklch(0.6439 0.1304 231.41) 100%)",isMobile?50:0)} />
            <div key={`g3-${recalc}`} style={gradStyle(sec3Ref,"linear-gradient(180deg,oklch(0.6439 0.1304 231.41) 0%,oklch(0.8978 0.185652 98.2159) 30%,oklch(0.8978 0.185652 98.2159) 100%)")} />
            <div key={`g5-${recalc}`} style={gradStyle(sec5Ref,"linear-gradient(180deg,oklch(0.8978 0.185652 98.2159) 0%,oklch(0.5746 0.2126 29.55) 30%,oklch(0.5746 0.2126 29.55) 100%)")} />
            <div key={`g8-${recalc}`} style={gradStyle(sec8Ref,"linear-gradient(180deg,oklch(0.5746 0.2126 29.55) 0%,oklch(0.8461 0.0069 115.73) 30%,oklch(0.8461 0.0069 115.73) 100%)")} />
          </>}
        </div>}
        {/* Navbar — exact inline styles from getMenuStyle + getButtonsNavbar */}
        <div style={{ position:"sticky", top:0, left:0, right:0, height:64, backgroundColor:"var(--vibes-cream)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", zIndex:1000, borderBottom:"1px solid black", fontFamily:"'Alte Haas Grotesk',Inter,sans-serif", borderTopLeftRadius:10, borderTopRightRadius:10, boxShadow:"0px 1px 0px 0px var(--vibes-cream)" }}>
          <VibesSwitch size={64} />
          <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div className="navbar-button-wrapper">
              {/* Button — exact from getButtonsNavbar */}
              <button
                onClick={()=>setIsDark(!isDark)}
                style={{
                  display:"flex", alignItems:"center", height:63,
                  backgroundColor: isDark ? "#fa5c00ff" : "#5398c9",
                  fontFamily:"'Alte Haas Grotesk',Inter,sans-serif",
                  border:"none", cursor:"pointer",
                  transition:"all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  overflow:"hidden", padding:0, position:"relative",
                }}
              >
                {/* Icon wrapper — exact from getNavbarButtonIconWrapper */}
                <div className="navbar-button-icon" style={{width:64,height:63,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {isDark ? <SunIcon /> : <MoonIcon />}
                </div>
                {/* Label — exact from getNavbarButtonLabel */}
                <div className="navbar-button-label" style={{color:"var(--vibes-cream)",fontSize:14,fontWeight:"bold",whiteSpace:"nowrap",fontFamily:"'Alte Haas Grotesk',Inter,sans-serif",textTransform:"uppercase",letterSpacing:"1.5px",opacity:0,transition:"all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",overflow:"hidden",display:"inline-block",textShadow:"1px 1px 2px rgba(0,0,0,0.3)",flexShrink:0}}>
                  {isDark ? "Light" : "Dark"}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Content container (exact from getContainerStyle + getInnerContainerStyle) */}
        <div style={{ width:"100%", minHeight:"100vh", color:"white", position:"relative", overflow:"visible", backgroundColor:"transparent", zIndex:3 }}>
          <div style={{ width:"100%", minHeight:"100vh", position:"relative", padding: isMobile?20:0 }}>

            {/* Hero section */}
            <DraggableSection color="grey" x={20} y={20} removePaddingTop>
              <h2 style={{fontSize:50,fontWeight:"bold",lineHeight:"50px",color:"#1a1a1a"}}>Impress the Group Chat</h2>
              <p style={{fontWeight:"bold",fontSize:22,lineHeight:"36px",color:"#444",marginTop:8}}>Instantly make your own apps on the fly</p>
            </DraggableSection>

            {/* Mobile chat */}
            {isMobile && (
              <DraggableSection color="blue" x={20} y={170}>
                <ChatAnimation
                  title={scenario.title}
                  arrayOfMessages={scenario.messages.map(m => ({ user: m.user, message: m.text }))}
                  user={"You"}
                />
              </DraggableSection>
            )}

            {/* Scattered cards */}
            <DraggableCard color="red" x={860} y={180} isText>
              <p style={{fontWeight:"bold",fontSize:20,lineHeight:"25px",maxWidth:isMobile?"100%":270}}>Our <a href="https://fireproof.storage/" style={{color:"inherit",textDecoration:"underline"}}>vibe coding database</a> encrypts all your data. Which means the group chat stays local, portable, and safe.</p>
            </DraggableCard>

            <DraggableCard color="blue" x={620} y={60} isText>
              <p style={{fontWeight:"bold",fontSize:20,lineHeight:"25px",maxWidth:isMobile?"100%":250}}>No coding experience required. Just type an idea, and invite your friends.</p>
            </DraggableCard>

            <DraggableCard color="yellow" x={860} y={20} isText>
              <p style={{fontWeight:"bold",fontSize:20,lineHeight:"25px"}}>No app store. No downloads.</p>
            </DraggableCard>

            <DraggableCard color="grey" x={820} y={520}>
              <div style={{position:"relative",margin:"-16px -8px",width:320,height:242}}>
                <img src="/computer-anim.gif" style={{width:"100%",height:"100%",display:"block"}} />
              </div>
            </DraggableCard>

            {/* Desktop-only scattered image cards */}
            {!isMobile && <>
              <DraggableCard color="yellow" x={200} y={1600}>
                <div style={{maxWidth:250}}><img src="/rainbow-computer.gif" style={{width:"100%",height:"100%",display:"block"}} /></div>
              </DraggableCard>
              <DraggableCard color="blue" x={950} y={2880}>
                <div style={{maxWidth:250}}><img src="/fireproof-logo.png" style={{width:"100%",height:"100%",display:"block"}} /></div>
              </DraggableCard>
              <DraggableCard color="yellow" x={830} y={4100}>
                <div style={{maxWidth:140}}><img src="/html.png" style={{width:"100%",height:"100%",display:"block"}} /></div>
              </DraggableCard>
              <DraggableCard color="yellow" x={900} y={5300}>
                <img style={{maxWidth:340}} src="/mouth.gif" />
              </DraggableCard>
            </>}

            {/* Desktop chat (sticky, exact from getChatContainerStyleOut + getChatContainerStyle) */}
            {!isMobile && (
              <div style={{ width:"100%", display:"flex", flexDirection:"column", position:"relative", alignItems:"baseline" }}>
                <div style={{ width:"100%", maxWidth:500, margin:"10px 20px", marginTop:170, marginBottom:100, display:"flex", flexDirection:"column", fontFamily:"'Segoe UI',system-ui,sans-serif", position:"sticky", top:100 }}>
                  {/* Topbar */}
                  <div style={{ height:30, width:"100%", background:"#1f0f9866", border:"1px solid black", marginBottom:1 }} />
                  {/* Messages */}
                  <div style={{ padding:16, paddingBottom:200, background:"var(--vibes-cream)", color:"#221f20", border:"1px solid black", boxShadow:"0 0 0 1px white", display:"flex", flexDirection:"column", gap:24, maxHeight:600, overflowY:"auto", scrollbarWidth:"none" }}>
                    {scenario.title && <div style={{fontSize:12,textAlign:"center"}}>{scenario.title}</div>}
                    {scenario.messages.map((m,i) => {
                      const me = m.user === "You";
                      return (
                        <div key={i} className={me?"message-current-user":"message-other-user"} style={{display:"flex",flexDirection:"column",alignItems:me?"flex-end":"flex-start",maxWidth:"70%",alignSelf:me?"flex-end":"flex-start",gap:8}}>
                          <div style={{fontSize:12,fontWeight:600,color:"rgba(0,0,0,0.7)",marginBottom:4,paddingLeft:me?0:12,paddingRight:me?12:0,textAlign:me?"right":"left"}}>{m.user}</div>
                          <div style={{padding:"16px 20px",borderRadius:me?"20px 20px 4px 20px":"20px 20px 20px 4px",background:me?"var(--vibes-cream)":"#5298c8",color:me?"#000":"#fff",wordWrap:"break-word",fontSize:15,lineHeight:1.6,fontWeight:"bold",border:me?"1px solid #000":"1px solid rgba(255,255,255,0.1)",position:"relative"}}>{linkify(m.text)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Content sections */}
            <div ref={secsRef} style={{ width:"100%", minHeight:"100vh", display:"flex", flexDirection:"column", gap: isMobile?300:30, position:"relative", marginTop: isMobile?400:0 }}>

              {/* Section 0: AnimatedScene (exact layout from original) */}
              <section ref={sec0Ref} style={{position:"relative",display:"flex",alignItems:isMobile?"center":"stretch",justifyContent:"center",width:"100%",padding:isMobile?"40px 0":"100px 0 200px",overflow:"hidden",gap:0,flexDirection:isMobile?"column":"row",minHeight:"100vh"}}>
                {/* Left column: text changes based on progress (1/3) */}
                <div style={{flex:isMobile?"0 0 auto":"0 0 33.33%",display:"flex",alignItems:"center",zIndex:isMobile?2:1,position:isMobile?"sticky":"relative",...(isMobile&&{padding:"0 20px",height:"50vh",top:0,background:"transparent"})}}>
                  {animProgress < 33 && (
                    <DraggableSection color="blue" static>
                      <h3 style={{fontSize:40,fontWeight:"bold",lineHeight:"40px",marginBottom:12,color:"#5398c9"}}>You're about to make an app</h3>
                      <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:12}}>
                        <b style={{fontSize:28,lineHeight:"28px"}}>The front-end is the fun part</b>
                        <p style={{lineHeight:1.7}}>Let's start there. Let's say you want to make a simple counter that keeps track of the number of times a group of people click a red button.</p>
                        <p style={{lineHeight:1.7}}>Most AI models will give you something cool right away.</p>
                      </div>
                    </DraggableSection>
                  )}
                  {animProgress >= 33 && animProgress < 66 && (
                    <DraggableSection color="yellow" static>
                      <h3 style={{fontSize:40,fontWeight:"bold",lineHeight:"40px",marginBottom:12,color:"#FEDD00"}}>Back to your counter app...</h3>
                      <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:12}}>
                        <b style={{fontSize:28,lineHeight:"28px"}}>Now you're using Fireproof + Vibes DIY</b>
                        <p style={{lineHeight:1.7}}>Your data lives locally inside your component, syncing when and where you choose. Conflicts resolve sensibly. State just... persists.</p>
                        <p style={{lineHeight:1.7}}>You can build offline, share instantly, and grow without rewriting your stack.</p>
                      </div>
                    </DraggableSection>
                  )}
                  {animProgress >= 66 && (
                    <DraggableSection color="red" static>
                      <h3 style={{fontSize:40,fontWeight:"bold",lineHeight:"40px",marginBottom:12,color:"#D94827"}}>Build together, instantly</h3>
                      <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:12}}>
                        <b style={{fontSize:28,lineHeight:"28px"}}>No setup, no friction</b>
                        <p style={{lineHeight:1.7}}>Share your creations with a simple link. Your friends can jump in immediately — no downloads, no waiting.</p>
                        <p style={{lineHeight:1.7}}>Everyone's changes sync in real-time, and your data stays safe and encrypted locally.</p>
                      </div>
                    </DraggableSection>
                  )}
                </div>

                {/* Right column: exact from original */}
                {isMobile ? (
                  <div style={{width:"100%",height:"50vh",position:"relative",zIndex:1}}>
                    <AnimatedScene progress={animProgress} />
                  </div>
                ) : (
                  <>
                    {/* Desktop: placeholder 2/3 width */}
                    <div style={{flex:"0 0 66.66%",position:"relative",pointerEvents:"none"}} />
                    {/* Desktop: scrollable overlay covering full section */}
                    <div
                      ref={animScrollRef}
                      className="animated-scene-wrapper scroll-hide"
                      style={{position:"absolute",top:"50%",left:0,right:0,transform:"translateY(-50%)",height:"100vh",overflowY:"auto",overflowX:"hidden",background:"transparent",zIndex:10,pointerEvents:"auto"}}
                    >
                      <div style={{height:"200vh"}}>
                        <div style={{position:"sticky",top:0,width:"100%",height:"100vh",display:"flex"}}>
                          <div style={{flex:"0 0 33.33%",pointerEvents:"none"}} />
                          <div style={{flex:"0 0 66.66%",position:"relative",height:"100%"}}>
                            <AnimatedScene progress={animProgress} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </section>

              {/* Section 1 */}
              <section ref={sec1Ref} style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",width:"100%",padding:isMobile?"0px 20px":"200px 0",overflow:"hidden"}}>
                <div style={{display:"flex",width:isMobile?"100%":"calc(100% - 80px - 40px)",margin:isMobile?"0":"40px",gap:isMobile?200:30,flexDirection:isMobile?"column":"row"}}>
                  <div style={{flex:isMobile?"1":"0 0 66.66%",display:"flex",alignItems:"center",zIndex:1,position:"relative"}}>
                    <DraggableSection color="blue" static removeMargin>
                      <h3 style={{fontSize:40,fontWeight:"bold",lineHeight:"40px",marginBottom:12,color:"#5398c9"}}>The Vibe Coding Stack Made for Coding Agents</h3>
                      <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:12}}>
                        <b style={{fontSize:28,lineHeight:"28px"}}>It's not for you. It's for them.</b>
                        <p style={{lineHeight:1.7}}>Vibes DIY is so obsessed with making a better vibe coding experience that we started by making our own database. The Vibes DIY web stack is open source, and uses a sync-engine powered by our database, <a style={{color:"#D92A1C",textDecoration:"underline",cursor:"pointer"}} href="https://fireproof.storage/">Fireproof</a>.</p>
                        <p style={{lineHeight:1.7}}>Our timing is good.</p>
                        <p style={{lineHeight:1.7}}>And yet modern apps are still a maze of clients, servers, endpoints, retries, caches, and edge cases. So let's ask a different question...</p>
                      </div>
                    </DraggableSection>
                  </div>
                  {!isMobile && <div style={{flex:"0 0 33.33%",display:"flex",alignItems:"center",zIndex:1,position:"relative"}}>
                    <DraggableSection color="blue" static removeMargin>
                      <h3 style={{fontSize:40,fontWeight:"bold",lineHeight:"40px",marginBottom:12,color:"#5398c9"}}>Let's Ask the AI.</h3>
                      <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:12}}>
                        <b style={{fontSize:28,lineHeight:"28px"}}>What do you actually want to generate?</b>
                        <TerminalDemo isMobile={isMobile} />
                      </div>
                    </DraggableSection>
                  </div>}
                </div>
              </section>

              {/* Section 3: Vibe Zone */}
              <section ref={sec3Ref} style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",width:"100%",padding:isMobile?"0px 20px":"500px 0 200px",overflow:"hidden"}}>
                <DraggableSection color="yellow" static>
                  <h3 style={{fontSize:40,fontWeight:"bold",lineHeight:"40px",marginBottom:12,color:"#FEDD00"}}>Now comes the hard part</h3>
                  <div style={{marginTop:12}}>
                    {!isMobile && <img src="/vibe-zone.png" alt="Vibe Zone chart" style={{float:"right",maxWidth:525,marginLeft:24,marginRight:14,marginBottom:16,borderRadius:8}} />}
                    <b style={{fontSize:28,lineHeight:"28px",display:"block",marginBottom:18}}>You're about to leave the Vibe Zone</b>
                    <p style={{marginBottom:18}}>Every vibe-coded project starts in the vibe zone. The model understands you. Progress is fast. Each change moves the app forward.</p>
                    {isMobile && <div style={{display:"flex",justifyContent:"center"}}><img src="/vibe-zone.png" alt="Vibe Zone chart" style={{width:"100%",marginBottom:18,borderRadius:8}} /></div>}
                    <p style={{marginBottom:18}}>Then something small goes wrong. A slightly off assumption. A fix that mostly works. A new edge case layered on top of the last one.</p>
                    <p style={{marginBottom:18}}>You correct it. Then correct the correction. And suddenly progress slows to a crawl.</p>
                    <p style={{marginBottom:18}}>Vibes DIY keeps things simple enough that you and your coding agent stay where you want to be. In the vibe zone.</p>
                    <div style={{clear:"both"}} />
                  </div>
                </DraggableSection>
              </section>

              {/* Section 5 */}
              <section ref={sec5Ref} style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",width:"100%",padding:isMobile?"0px 20px":"500px 0 200px",overflow:"hidden"}}>
                <DraggableSection color="red" static>
                  <h3 style={{fontSize:40,fontWeight:"bold",lineHeight:"40px",marginBottom:12,color:"#DA291C"}}>One shot. Then Ship It.</h3>
                  <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:12}}>
                    <b style={{fontSize:28,lineHeight:"28px"}}>Get more app for your prompt.</b>
                    <p style={{lineHeight:1.7}}>When you vibe code an app, your coding agent has to choose a web stack. When you tell your agent to use the Vibe Stack, you're giving it an unfair advantage. Because Vibes collapses <i>application code</i> and <i>application state</i> into a single, local HTML file.</p>
                    <p style={{lineHeight:1.7}}>Think about it. AI doesn't make apps - it makes <i>text</i>. Embedding the database in javascript (via the browser) lets your agent describe an entire app—including its persistence layer—<strong>in one shot</strong>.</p>
                    <p style={{lineHeight:1.7}}>This yields a brand new vibe coding magic trick: prompt-to-vibe. A single file encodes UI, logic, and seed data, making vibe-coded apps trivially shareable and endlessly remixable by your group chat.</p>
                  </div>
                </DraggableSection>
              </section>

              {/* Section 8: Join */}
              <section ref={sec8Ref} style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",width:"100%",padding:isMobile?"0px 20px":"500px 0 200px",overflow:"hidden"}}>
                <DraggableSection color="grey" static>
                  <h3 style={{fontSize:40,fontWeight:"bold",lineHeight:"40px",marginBottom:12,color:"#000"}}>Join the party</h3>
                  <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:12}}>
                    <b style={{fontSize:28,lineHeight:"28px"}}>You're early. But right on time.</b>
                    <p style={{lineHeight:1.7}}>Volunteer sign-ups and school drop-offs. Project checklists and vacation planners. Each of these concepts can be vibe coded in <i>60 seconds</i>. Whatever the vibe, you can build it with Vibes.</p>
                    <p style={{lineHeight:1.7}}>You and your friends aren't users anymore. You're makers.</p>
                    <p style={{lineHeight:1.7}}>Curious? <a style={{color:"#D92A1C",textDecoration:"underline"}} href="https://discord.gg/vnpWycj4Ta">Join our Discord</a>, <a style={{color:"#D92A1C",textDecoration:"underline"}} href="https://vibesdiy.substack.com/">read our Substack</a>, and follow us on <a style={{color:"#D92A1C",textDecoration:"underline"}} href="https://www.youtube.com/@VibesDIY">YouTube</a>, <a style={{color:"#D92A1C",textDecoration:"underline"}} href="https://github.com/VibesDIY">Github</a>, and <a style={{color:"#D92A1C",textDecoration:"underline"}} href="https://bsky.app/profile/vibes.diy">Bluesky</a>.</p>
                  </div>
                </DraggableSection>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
