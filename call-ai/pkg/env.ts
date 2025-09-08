import { Env, envFactory, Lazy } from "@adviser/cement";

class CallAIEnv {
  env = Lazy(() => {
    return envFactory({ symbol: "callAi" });
  });

  merge(oEnv: Env) {
    const myEnv = this.env();
    myEnv.keys().forEach((k) => {
      const v = myEnv.get(k);
      if (!v) {
        oEnv.set(k, myEnv.get(k));
      }
    });
    this.env = () => oEnv;
    return oEnv;
  }

  readonly def = {
    get CALLAI_REFRESH_ENDPOINT() {
      // ugly as hell but useful
      return callAiEnv.CALLAI_REFRESH_ENDPOINT ?? "https://vibecode.garden";
    },
    get CALLAI_CHAT_URL() {
      return callAiEnv.CALLAI_CHAT_URL ?? "https://vibes-diy-api.com";
    },
  };

  getWindowCALLAI_IMG_URL() {
    const w = globalThis.window as {
      CALLAI_IMG_URL?: string;
      callAi?: { IMG_URL?: string };
    };
    return w.CALLAI_IMG_URL ?? w.callAi?.IMG_URL;
  }

  get CALLAI_IMG_URL() {
    return this.env().get("CALLAI_IMG_URL") ?? this.getWindowCALLAI_IMG_URL();
  }

  get CALLAI_CHAT_URL() {
    return this.env().get("CALLAI_CHAT_URL");
  }

  getWindowCALLAI_API_KEY() {
    const w = globalThis.window as {
      CALLAI_API_KEY?: string;
      callAi?: { API_KEY?: string };
    };
    return w.CALLAI_API_KEY ?? w.callAi?.API_KEY;
  }

  get CALLAI_API_KEY() {
    return (
      this.env().get("CALLAI_API_KEY") ??
      this.env().get("OPENROUTER_API_KEY") ??
      this.getWindowCALLAI_API_KEY() ??
      this.env().get("LOW_BALANCE_OPENROUTER_API_KEY") ??
      "sk-vibes-proxy-managed"
    );
  }
  get CALLAI_REFRESH_ENDPOINT() {
    return this.env().get("CALLAI_REFRESH_ENDPOINT");
  }
  get CALL_AI_REFRESH_TOKEN() {
    return this.env().get("CALL_AI_REFRESH_TOKEN");
  }

  get CALLAI_REKEY_ENDPOINT() {
    return this.env().get("CALLAI_REKEY_ENDPOINT");
  }
  get CALL_AI_KEY_TOKEN() {
    return this.env().get("CALL_AI_KEY_TOKEN");
  }
  get CALLAI_REFRESH_TOKEN() {
    return this.env().get("CALLAI_REFRESH_TOKEN");
  }
  get CALLAI_DEBUG() {
    return !!this.env().get("CALLAI_DEBUG");
  }

  get NODE_ENV() {
    return this.env().get("NODE_ENV");
  }
}

export const callAiEnv = new CallAIEnv();
