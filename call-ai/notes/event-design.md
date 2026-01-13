 there will be multiple integration patterns of a LLM2CallAI2 --- and I'm currently not decided which is the way to go --- that decision is mainly time constrained or feature constrained --- I want to have flexibility, not something working.
The quality of the components is the critical part of flexibility, not the integration.

We need a stable, maintainable StreamConverter for our format!!! --- To register, you need to join all onFuncs and have a standard EventFormat. pls use this arktype or zod. Just think about that we can plug evento directly into the register function

basically all tests should look like: 
const x = new LLM2CallAI2()
const testFn = vi.fn())
x.register(testFn)
await x.processPrompt({ prompt: xxxxx, model: xxxxx, inputStream: ReadableStream } )
expect(testFn.mock.calls).toEqual([
   [{ type: reqBeginCallAIStream, payload: { prompt: xxxxx, model: xxxxxx, streamId: id }]
  [{type: reqEndCallAiStream, payload: { streamId: id, stats: { tokens, outBytes, inBytes, .... } }]
])
use arktype not zod

class LLM2CallAI2 {
readonly register = OnFunc<() => void>()
  processPrompt(x) {
      this.register.invoke({xxxxxx});
} 
}

commit 32ed35ceacf419098c0fcf1ddffa9eced02db5b1

  const evento = vibesApiEvento(); // here are the registers
  const send = new SendResponseProvider();
  return async (req: Request, bindPromise: BindPromise<Result<unknown>> = (p) => p): Promise<Response> => {
   
      evento.trigger({
        ctx: vibesApiCtx,
        send,
        request: req,
      }),
    );
    return send.getResponse();
  };

  