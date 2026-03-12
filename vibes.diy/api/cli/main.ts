import { ensureSuperThis } from "@fireproof/core-runtime";
import { run, subcommands } from "cmd-ts";

import { dotenv } from "zx";
import { deviceIdCmd } from "./device-id-cmd.js";

(async () => {
  dotenv.config(process.env.FP_ENV ?? ".env");
  const sthis = ensureSuperThis();

  const cmd = subcommands({
    name: "vibes.diy-api-cli",
    description: "vibes.diy api cli",
    version: "1.0.0",
    cmds: {
      deviceId: deviceIdCmd(sthis),
    },
  });

  await run(cmd, process.argv.slice(2));
})().catch(console.error);
