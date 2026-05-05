import { FPDeviceIDSession, SuperThis } from "@fireproof/core";
import { AppContext, EventoSendProvider, exception2Result, HandleTriggerCtx, Lazy, processStream, Result } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { getKeyBag } from "@fireproof/core-keybag";
import { DeviceIdKey, DeviceIdSignMsg } from "@fireproof/core-device-id";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { dotenv } from "zx";
import { cmd_tsStream } from "./cmd-ts-stream.js";
import { runSafely, subcommands, setDefaultHelpFormatter, defaultHelpFormatter } from "cmd-ts";
import { getCliFooter } from "@vibes.diy/prompts";
import { isResEnsureUserSettings, isUserSettingSharing, isResEnsureAppSlug } from "@vibes.diy/api-types";
import { userSettingsCmd } from "./cmds/user-settings-cmd.js";
import { loginCmd } from "./cmds/login-cmd.js";
import { pushCmd } from "./cmds/push-cmd.js";
import { generateCmd, isResGenerate } from "./cmds/generate-cmd.js";
import { skillsCmd, isResSkillsList, isResSkillContent } from "./cmds/skills-cmd.js";
import { systemCmd, isResSystem } from "./cmds/system-cmd.js";
import { CliCtx, defaultCliOutput } from "./cli-ctx.js";
import { cmdTsEvento, isCmdProgress, WrapCmdTSMsg } from "./cmd-evento.js";
import { isResDeviceIdRegister } from "@fireproof/core-cli";
import { err, isErr } from "cmd-ts/dist/cjs/Result.js";

async function vibesDiyApiFactory(sthis: SuperThis) {
  const kb = await getKeyBag(sthis);
  const devid = await kb.getDeviceId();
  const rDevkey = await DeviceIdKey.createFromJWK(devid.deviceId.Unwrap());
  if (rDevkey.isErr()) {
    throw rDevkey.Err();
  }
  if (devid.cert.IsNone()) {
    throw new Error("Device ID certificate is missing");
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const payload = devid.cert.Unwrap()!.certificatePayload;
  const deviceIdSigner = new DeviceIdSignMsg(sthis.txt.base64, rDevkey.Ok(), payload);
  let seq = 0;
  const getToken = Lazy(
    async (): Promise<Result<DashAuthType>> => {
      const now = Math.floor(Date.now() / 1000);
      const token = await deviceIdSigner.sign(
        {
          iss: "use-vibes/cli",
          sub: "device-id",
          deviceId: await rDevkey.Ok().fingerPrint(),
          seq: ++seq,
          exp: now + 120,
          nbf: now - 2,
          iat: now,
          jti: sthis.nextId().str,
        } satisfies FPDeviceIDSession,
        "ES256"
      );
      return Result.Ok({
        type: "device-id",
        token,
      });
    },
    { resetAfter: 60, skipUnref: true }
  );
  return (apiUrl: string, opts?: { idleTimeoutMs?: number }) => {
    return new VibesDiyApi({
      apiUrl,
      getToken,
      ...(opts?.idleTimeoutMs !== undefined ? { timeoutMs: opts.idleTimeoutMs } : {}),
    });
  };
}

class OutputSelector implements EventoSendProvider<unknown, unknown, unknown> {
  readonly tstream = new TransformStream<unknown, WrapCmdTSMsg<unknown>>();
  readonly outputStream: ReadableStream<WrapCmdTSMsg<unknown>> = this.tstream.readable;
  readonly writer = this.tstream.writable.getWriter();
  async send<IS, OS>(trigger: HandleTriggerCtx<unknown, unknown, unknown>, data: IS): Promise<Result<OS, Error>> {
    await this.writer.write(data);
    return Promise.resolve(Result.Ok());
  }
  done(_trigger: HandleTriggerCtx<unknown, unknown, unknown>): Promise<Result<void>> {
    this.writer.releaseLock();
    this.tstream.writable.close();
    return Promise.resolve(Result.Ok());
  }
}

async function main(): Promise<number> {
  const sthis = ensureSuperThis();

  const env = dotenv.loadSafe(".dev.vars", ".env");
  sthis.env.sets({ ...env } as Record<string, string>);
  const rApiFactory = await exception2Result(() => vibesDiyApiFactory(sthis));
  const ctx: CliCtx = {
    sthis,
    cliStream: cmd_tsStream(),
    output: defaultCliOutput,
    vibesDiyApiFactory: rApiFactory.isOk() ? rApiFactory.Ok() : undefined,
    exitCode: 0,
  };
  const rFooter = await exception2Result(() => getCliFooter());
  const cliFooter = rFooter.isOk() ? rFooter.Ok() : "";
  setDefaultHelpFormatter({
    formatCommand: defaultHelpFormatter.formatCommand,
    formatSubcommands(data, context) {
      const base = defaultHelpFormatter.formatSubcommands(data, context);
      return cliFooter ? base + "\n" + cliFooter : base;
    },
  });

  const rs = await runSafely(
    subcommands({
      name: "vibes-diy CLI",
      description: "vibes-diy cli",
      version: "1.0.0",
      cmds: {
        generate: generateCmd(ctx),
        login: loginCmd(ctx),
        push: pushCmd(ctx),
        skills: skillsCmd(ctx),
        system: systemCmd(ctx),
        "user-settings": userSettingsCmd(ctx),
      },
    }),
    process.argv.slice(2)
  );
  if (isErr(rs)) {
    console.error(err(rs).error.error.config.message);
    process.exit(err(rs).error.error.config.exitCode);
  }

  const outputSelector = new OutputSelector();
  const evento = cmdTsEvento();
  const appCtx = new AppContext().set("cliCtx", ctx);

  await Promise.all([
    processStream(
      ctx.cliStream.stream,
      (msg) => {
        return evento
          .trigger({
            ctx: appCtx,
            send: outputSelector,
            request: msg,
          })
          .then((r) => {
            if (r.isErr()) {
              console.error("Error:", String(r.Err()));
              ctx.exitCode = 1;
              return;
            }
            const stepCtx = r.Ok();
            if (stepCtx.error) {
              console.error("Error:", String(stepCtx.error));
              ctx.exitCode = 1;
            }
          });
      },
      processStream(outputSelector.outputStream, async (wmsg) => {
        const msg = wmsg.result;
        switch (true) {
          case isCmdProgress(msg): {
            switch (msg.level) {
              case "warn":
                console.warn(msg.message);
                break;
              case "error":
                console.error(msg.message);
                break;
              default:
                console.log(msg.message);
                break;
            }
            break;
          }
          case isResEnsureUserSettings(msg): {
            console.log("UserId: ", msg.userId);
            console.log("Setting:");
            for (const set of msg.settings.filter(isUserSettingSharing)) {
              console.log(` Type:`, set.type, ` Grants:`, JSON.stringify(set.grants));
            }
            break;
          }
          case isResSkillsList(msg): {
            for (const skill of msg.skills) {
              console.log(`${skill.name.padEnd(12)}${skill.description}`);
            }
            break;
          }
          case isResSkillContent(msg): {
            console.log(msg.content);
            break;
          }
          case isResSystem(msg): {
            console.log(msg.systemPrompt);
            break;
          }
          case isResDeviceIdRegister(msg): {
            console.log(msg.output);
            break;
          }
          case isResEnsureAppSlug(msg): {
            // Already reported via sendProgress in push handler
            break;
          }
          case isResGenerate(msg): {
            // Already reported via sendProgress in generate handler
            break;
          }
          default:
            console.error("Unhandled:", JSON.stringify(msg, null, 2));
            break;
        }
      })
    ),
    ctx.cliStream.close(),
  ]);
  return ctx.exitCode;
}

main()
  .catch((e) => {
    console.error("Error in use-vibes cli:", e);
    process.exit(1);
  })
  .then((code) => process.exit(code));
