# tilt-gyro-flippers

> Pinball where flippers are triggered by tilting the phone left/right (DeviceOrientation API; fall back to A/L keys). One ball, three bumpers, drain. Calibrate-tilt button. Each session saves to Fireproof; show tilt-sensitivity slider and last 5 scores.

Live at [https://vibes.diy/vibe/og/tilt-gyro-flippers](https://vibes.diy/vibe/og/tilt-gyro-flippers)

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory
- `npx vibes-diy push --instant-join` — deploy with auto-accept sharing
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
