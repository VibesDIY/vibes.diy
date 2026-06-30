import { Evento, EventoHandler, Result } from "@adviser/cement";
import { isCmdTSMsg, WrapCmdTSMsg } from "@vibes.diy/cmd-tools";

// Build the cmd-ts evento bus that routes each streamed `msg.cmd-ts` envelope to
// its command handler. The encode step unwraps the envelope's `result` for the
// handler; decode is identity. Each CLI passes only its own handler list.
export function makeCmdTsEvento(handlers: EventoHandler<WrapCmdTSMsg<unknown>, unknown, unknown>[]) {
  const evento = new Evento({
    encode: (i) => {
      if (isCmdTSMsg(i)) {
        return Promise.resolve(Result.Ok(i.result));
      }
      return Promise.resolve(Result.Err("not a cmd-ts-msg"));
    },
    decode: (i) => Promise.resolve(Result.Ok(i)),
  });
  evento.push(handlers);
  return evento;
}
