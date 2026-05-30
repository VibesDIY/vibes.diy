import { SetURLSearchParams, useNavigate, useParams, useSearchParams } from "react-router";
import React, { useEffect, useState, useReducer, useRef, useCallback } from "react";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { useAuth } from "@clerk/react";
import { processStream, BuildURI, URI, exception2Result } from "@adviser/cement";
import { fireproof } from "@fireproof/use-fireproof";
import type { VibeDocument, ViewType, VibesTheme } from "@vibes.diy/prompts";
import { vibesThemes, getThemeBySlug } from "@vibes.diy/prompts";
import {
  isPromptBlockBegin,
  isPromptBlockEnd,
  isPromptReq,
  LLMChat,
  LLMChatEntry,
  PromptAndBlockMsgs,
  PromptError,
  sectionEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import AppLayout from "../../components/AppLayout.js";
import { BrutalistCard } from "@vibes.diy/base";
import SessionSidebar from "../../components/SessionSidebar.js";
import ChatInput, { ChatInputRef } from "../../components/ChatInput.js";
import ThemePickerModal from "../../components/ThemePickerModal.js";
import { isMobileViewport, useViewState } from "../../utils/ViewState.js";
import { useFreshFirstCodegen } from "../../utils/freshFirstCodegen.js";
import { isCodeBegin, isBlockEnd } from "@vibes.diy/call-ai-v2";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import ChatHeaderContent from "../../components/ChatHeaderContent.js";
import ChatInterface from "../../components/ChatInterface.js";
import { ResultPreviewHeaderContent } from "../../components/ResultPreview/ResultPreviewHeaderContent.js";
import { useShareModal } from "../../components/ResultPreview/useShareModal.js";
import ResultPreview from "../../components/ResultPreview/ResultPreview.js";
import { Delayed } from "../../components/Delayed.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { useBuildCompletionNotifications } from "../../hooks/useBuildCompletionNotifications.js";
import { notifyRecentVibesChanged, subscribeRecentVibesChanged } from "../../hooks/useRecentVibes.js";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import { EditorState, isEditorStateEdit } from "../../types/code-editor.js";

interface VibeAppContextMenuProps {
  x: number;
  y: number;
  vibeHref: string;
  sandboxUrl?: string;
  onClose: () => void;
}

function VibeAppContextMenu({ x, y, vibeHref, sandboxUrl, onClose }: VibeAppContextMenuProps) {
  return createPortal(
    <div
      style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className="bg-light-background-00 dark:bg-dark-background-00 border-light-decorative-01 dark:border-dark-decorative-01 flex flex-col gap-1 rounded-md border p-2 shadow-lg text-sm"
      onMouseLeave={onClose}
    >
      <a
        href={vibeHref}
        target="_blank"
        rel="noreferrer"
        className="text-light-primary dark:text-dark-primary hover:underline px-2 py-1"
      >
        Open vibe
      </a>
      {sandboxUrl && (
        <a
          href={sandboxUrl}
          target="_blank"
          rel="noreferrer"
          className="text-light-primary dark:text-dark-primary hover:underline px-2 py-1"
        >
          Open sandbox
        </a>
      )}
    </div>,
    document.body
  );
}

export interface PromptState {
  chat: LLMChatEntry;
  running: boolean;
  current?: PromptBlock;
  blocks: PromptBlock[];
  hasCode: boolean;
  title: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  // Source-of-truth code for a given fsId when no ChatSections exist for it
  // (e.g. after a remix where the Apps row was pointer-copied without a
  // replayed prompt). CodeEditor falls back to this when getCode returns no
  // blocks for the current fsId.
  hydratedSource?: { fsId: string; code: string[] };
  // Block IDs whose save originated from the agent autosave (end-of-aider-
  // turn) rather than a manual editor save. Populated only for the lifetime
  // of an open chat session — chat reload loses these tags and the MessageList
  // falls back to "User edited code" for old auto-saves. Acceptable: the
  // alternative would require a wire-format change.
  agentSavedBlockIds: ReadonlySet<string>;
  icon?: { cid: string; mime: string };
  // The selected theme (catalog or imported). Sourced from app_settings
  // alongside title/icon so a single dispatch updates all three.
  theme?: VibesTheme | null;
  // Optional colorset slug. When set, the codegen pipeline composes this
  // colorset's palette with the structural `theme`. Defaults to the same
  // slug as `theme` (matching today's behavior).
  colorTheme?: string | null;
}

export interface PromptBlock {
  // reqs: PromptReq[]
  msgs: PromptAndBlockMsgs[];
}

const InitChat = type({
  type: "'initChat'",
  chat: LLMChatEntry,
});
type InitChat = typeof InitChat.infer;

function isInitChat(msg: unknown): msg is InitChat {
  return !(InitChat(msg) instanceof type.errors);
}

const SetTitle = type({
  type: "'setTitle'",
  title: "string",
});
type SetTitle = typeof SetTitle.infer;

function isSetTitle(msg: unknown): msg is SetTitle {
  return !(SetTitle(msg) instanceof type.errors);
}

const SetIcon = type({
  type: "'setIcon'",
  icon: type({ cid: "string", mime: "string" }),
});
type SetIcon = typeof SetIcon.infer;

function isSetIcon(msg: unknown): msg is SetIcon {
  return !(SetIcon(msg) instanceof type.errors);
}

// SetTheme accepts a nullable theme so a single action can either set or clear
// the selection. Imported (custom) .md themes use the same shape — they're not
// in the catalog but the in-memory record is the same VibesTheme structure.
interface SetTheme {
  type: "setTheme";
  theme: VibesTheme | null;
}
function isSetTheme(msg: unknown): msg is SetTheme {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "setTheme";
}

// SetColorTheme stores just the slug — the colorset is composed at codegen
// time on the backend, so the frontend doesn't need the full color values
// in state. Nullable so the same action can clear the override (falling back
// to the colorset matching the structural theme's slug).
interface SetColorTheme {
  type: "setColorTheme";
  colorTheme: string | null;
}
function isSetColorTheme(msg: unknown): msg is SetColorTheme {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "setColorTheme";
}

const SetHydratedSource = type({
  type: "'setHydratedSource'",
  fsId: "string",
  code: "string[]",
});
type SetHydratedSource = typeof SetHydratedSource.infer;

function isSetHydratedSource(msg: unknown): msg is SetHydratedSource {
  return !(SetHydratedSource(msg) instanceof type.errors);
}

const MarkAgentSaved = type({
  type: "'markAgentSaved'",
  blockId: "string",
});
type MarkAgentSaved = typeof MarkAgentSaved.infer;

function isMarkAgentSaved(msg: unknown): msg is MarkAgentSaved {
  return !(MarkAgentSaved(msg) instanceof type.errors);
}

interface ClearChat {
  type: "clearChat";
  appSlug: string;
}

function isClearChat(msg: unknown): msg is ClearChat {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "clearChat";
}

type PromptAction =
  | PromptAndBlockMsgs
  | InitChat
  | SetTitle
  | SetIcon
  | SetTheme
  | SetColorTheme
  | SetHydratedSource
  | MarkAgentSaved
  | ClearChat;

function promptReducer(state: PromptState, block: PromptAction): PromptState {
  switch (true) {
    case isClearChat(block):
      return {
        ...state,
        chat: {} as LLMChatEntry,
        blocks: [],
        running: false,
        hasCode: false,
        current: undefined,
        title: block.appSlug,
        icon: undefined,
        theme: null,
        colorTheme: null,
        agentSavedBlockIds: new Set<string>(),
        hydratedSource: undefined,
      };

    case isInitChat(block):
      // console.log(`initChat`, block.chat)
      return { ...state, chat: block.chat };

    case isSetTitle(block):
      return { ...state, title: block.title };

    case isSetIcon(block):
      return { ...state, icon: block.icon };

    case isSetTheme(block):
      return { ...state, theme: block.theme };

    case isSetColorTheme(block):
      return { ...state, colorTheme: block.colorTheme };

    case isSetHydratedSource(block):
      return { ...state, hydratedSource: { fsId: block.fsId, code: block.code } };

    case isMarkAgentSaved(block): {
      const next = new Set(state.agentSavedBlockIds);
      next.add(block.blockId);
      return { ...state, agentSavedBlockIds: next };
    }

    // case isPromptReq(block):
    //   if (!state.current) return state;
    //   // console.log(`promptMsg`, block)
    //   return { ...state,
    //     current: { ...state.current, reqs: [...state.current.reqs, block]},
    //     blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, reqs: [...b.reqs, block] } : b)),
    //   };

    case isPromptBlockBegin(block): {
      const newBlock: PromptBlock = { msgs: [] };
      return {
        ...state,
        running: true,
        blocks: [...state.blocks, newBlock],
        current: newBlock,
      };
    }

    case isPromptBlockEnd(block):
      // console.log(`PromptBlock-End`, block);
      return { ...state, running: false };
    case isCodeBegin(block):
      if (!state.current) return state;
      return {
        ...state,
        hasCode: true,
        current: { ...state.current, msgs: [...state.current.msgs, block] },
        blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, msgs: [...b.msgs, block] } : b)),
      };
    default:
      if (!state.current) return state;
      // console.log("reqs", state.current?.reqs)
      // if (isBlockEnd(block)) {
      //   console.log(`recv:`, block)
      // }
      return {
        ...state,
        current: { ...state.current, msgs: [...state.current.msgs, block] },
        blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, msgs: [...b.msgs, block] } : b)),
      };
  }
}

export function Chat({ inConstruction = false }: { inConstruction?: boolean }) {
  const { userSlug = "preparing", appSlug = "session", fsId } = useParams<{ userSlug: string; appSlug: string; fsId?: string }>();
  useDocumentTitle(`${userSlug} - ${appSlug} - vibes.diy`);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [chat, setChat] = useState<LLMChat | null>(null);
  const openingRef = useRef(false);
  const prevSlugsRef = useRef(`${userSlug}/${appSlug}`);
  if (`${userSlug}/${appSlug}` !== prevSlugsRef.current) {
    openingRef.current = false;
    prevSlugsRef.current = `${userSlug}/${appSlug}`;
  }
  const { vibeDiyApi, webVars: svcVars, srvVibeSandbox } = useVibesDiy();
  const shareModal = useShareModal({ userSlug, appSlug, fsId, vibeDiyApi });
  const { isSignedIn } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingBump, setPendingBump] = useState(0);

  useEffect(() => {
    if (!isSignedIn || !userSlug) {
      setIsOwner(false);
      return;
    }
    let cancelled = false;
    void vibeDiyApi.listUserSlugBindings({}).then((res) => {
      if (cancelled) return;
      if (res.isErr()) {
        setIsOwner(false);
        return;
      }
      setIsOwner(res.Ok().items.some((item) => item.userSlug === userSlug));
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userSlug, vibeDiyApi]);

  useEffect(() => {
    if (!isOwner || !userSlug || !appSlug) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    void vibeDiyApi.listRequestGrants({ appSlug, userSlug, pager: { limit: 100 } }).then((res) => {
      if (cancelled || res.isErr()) return;
      setPendingCount(res.Ok().items.filter((r) => r.state === "pending").length);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, userSlug, appSlug, vibeDiyApi, pendingBump]);

  useEffect(() => {
    if (!isOwner || !userSlug || !appSlug) {
      return;
    }
    void vibeDiyApi.subscribeRequestGrants({ appSlug, userSlug });
    const unsubscribe = vibeDiyApi.onRequestGrant((evt) => {
      if (evt.grant.userSlug === userSlug && evt.grant.appSlug === appSlug) {
        setPendingBump((n) => n + 1);
      }
    });
    return unsubscribe;
  }, [isOwner, userSlug, appSlug, vibeDiyApi]);

  const prevShareOpenRef = useRef(shareModal.isOpen);
  useEffect(() => {
    if (prevShareOpenRef.current && !shareModal.isOpen) {
      setPendingBump((n) => n + 1);
    }
    prevShareOpenRef.current = shareModal.isOpen;
  }, [shareModal.isOpen]);

  const [promptToSend, sendPrompt] = useState<string | null>(null);
  const handleSelectOption = useCallback(
    (option: string) => {
      sendPrompt(option);
    },
    [sendPrompt]
  );
  const chatInput = useRef<ChatInputRef>(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  // Hold latest fsId in a ref so the prompt-firing effect can preserve it in
  // the navigation URL without retriggering on every autosave fsId change
  // (which would re-fire the same prompt — classic loop).
  const fsIdRef = useRef<string | undefined>(fsId);
  fsIdRef.current = fsId;

  // Read the local VibeDocument (seeded by the remix route) to show the
  // "remix of" indicator in the header. Best-effort: if the doc is missing
  // or malformed we just render the plain title.
  const [remixOf, setRemixOf] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await exception2Result(async () => {
        const db = fireproof(`vibe-${appSlug}`);
        return (await db.get("vibe")) as VibeDocument;
      });
      if (cancelled) return;
      if (r.isOk() && r.Ok().remixOf) setRemixOf(r.Ok().remixOf);
    })();
    return () => {
      cancelled = true;
    };
  }, [appSlug]);

  const [promptState, dispatch] = useReducer(promptReducer, {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: appSlug,
    blocks: [],
    searchParams,
    setSearchParams,
    agentSavedBlockIds: new Set<string>(),
  });

  useBuildCompletionNotifications();

  useEffect(() => {
    return subscribeRecentVibesChanged((change) => {
      if (change?.userSlug !== userSlug || change.appSlug !== appSlug || change.title === undefined) return;
      dispatch({ type: "setTitle", title: change.title.length > 0 ? change.title : appSlug });
    });
  }, [userSlug, appSlug]);

  // Clear stale messages immediately when navigating to a different chat so
  // the old conversation is not visible while the new one loads.
  const prevChatKeyRef = useRef(`${userSlug}/${appSlug}`);
  useEffect(() => {
    const key = `${userSlug}/${appSlug}`;
    if (key !== prevChatKeyRef.current) {
      prevChatKeyRef.current = key;
      dispatch({ type: "clearChat", appSlug });
    }
  }, [userSlug, appSlug, dispatch]);

  const handleThemeSelect = useCallback(
    (theme: VibesTheme) => {
      // Update the picker state via the same reducer that title/icon ride —
      // single source of truth, single re-render.
      dispatch({ type: "setTheme", theme });
      setThemeModalOpen(false);
      // Persist on backend if the theme is in the catalog. Imported (custom)
      // themes apply session-only — they're not in the catalog so the backend
      // would drop them on validation.
      const isCatalog = !!getThemeBySlug(theme.slug);
      const canPersist = isCatalog && userSlug !== "preparing" && appSlug !== "session";
      // Prefill the chat textarea with a default restyle prompt — only if
      // it's empty, so we don't clobber a half-typed message. The user can
      // edit before sending.
      const prefilled = chatInput.current?.setPromptIfEmpty("Please update the theme") ?? false;
      chatInput.current?.setFocus();
      if (!canPersist || !prefilled) {
        // Custom themes apply session-only (server still has the old theme),
        // and an existing draft means the user is mid-thought — in either
        // case let the user hit submit themselves.
        if (canPersist) {
          void vibeDiyApi.ensureAppSettings({ userSlug, appSlug, theme: theme.slug });
        }
        return;
      }
      // Wait for the theme to land in app_settings before kicking off the
      // restyle turn — the server builds the prompt by reading the active
      // theme, so submitting while ensureAppSettings is in flight can
      // process the turn against the previous theme.
      void vibeDiyApi.ensureAppSettings({ userSlug, appSlug, theme: theme.slug }).then((res) => {
        if (res.isErr()) return;
        chatInput.current?.clickSubmit();
      });
    },
    [vibeDiyApi, userSlug, appSlug]
  );

  // Persist a palette choice (slug only) so future codegen turns and page
  // reloads honor it. Live recolor is handled separately by handleApplyLive
  // — the picker calls both on swatch click so the user sees the swap and
  // the choice survives a refresh.
  const handlePaletteSelect = useCallback(
    (colorTheme: string) => {
      dispatch({ type: "setColorTheme", colorTheme });
      if (userSlug !== "preparing" && appSlug !== "session") {
        void vibeDiyApi.ensureAppSettings({ userSlug, appSlug, colorTheme });
      }
    },
    [vibeDiyApi, userSlug, appSlug]
  );

  // Live-only push: postMessage to the iframe so the runtime injects CSS
  // variable overrides. Used for both palette selection and per-token edits
  // (edits are session-only — they don't persist, so the page reload shows
  // the palette's pristine values).
  const handleApplyLivePalette = useCallback(
    (colors: Record<string, string>, colorsDark?: Record<string, string>) => {
      if (!srvVibeSandbox) return;
      srvVibeSandbox.pushColorOverride({
        type: "vibe.evt.color-override",
        colors,
        ...(colorsDark ? { colorsDark } : {}),
      });
    },
    [srvVibeSandbox]
  );

  // Regenerate-with-palette: persists the slug, then prefills the chat
  // textarea with a prompt that nudges the LLM to wire CSS variables to
  // the new palette tokens. Auto-submits so the user gets the regenerated
  // app without an extra click. Mirrors the structural-theme restyle flow.
  const handlePaletteRegenerate = useCallback(
    (paletteSlug: string, paletteName: string) => {
      dispatch({ type: "setColorTheme", colorTheme: paletteSlug });
      const canPersist = userSlug !== "preparing" && appSlug !== "session";
      const prompt = `Update the styles to use the "${paletteName}" palette. Apply the palette's colors via CSS variables on :root (and inside @media (prefers-color-scheme: dark) for dark-mode tokens), then reference them as var(--token) everywhere instead of inline hex values.`;
      const prefilled = chatInput.current?.setPromptIfEmpty(prompt) ?? false;
      chatInput.current?.setFocus();
      if (!canPersist || !prefilled) {
        if (canPersist) {
          void vibeDiyApi.ensureAppSettings({ userSlug, appSlug, colorTheme: paletteSlug });
        }
        return;
      }
      void vibeDiyApi.ensureAppSettings({ userSlug, appSlug, colorTheme: paletteSlug }).then((res) => {
        if (res.isErr()) return;
        chatInput.current?.clickSubmit();
      });
    },
    [vibeDiyApi, userSlug, appSlug]
  );

  // Reset reverts the override: pushing empty `colors` tells the runtime to
  // drop the injected <style>, and sending colorTheme: null removes the
  // active.colorTheme entry so future codegen falls back to the structural
  // theme's default palette.
  const handlePaletteReset = useCallback(() => {
    dispatch({ type: "setColorTheme", colorTheme: null });
    if (srvVibeSandbox) {
      srvVibeSandbox.pushColorOverride({ type: "vibe.evt.color-override", colors: {} });
    }
    if (userSlug !== "preparing" && appSlug !== "session") {
      void vibeDiyApi.ensureAppSettings({ userSlug, appSlug, colorTheme: null });
    }
  }, [vibeDiyApi, userSlug, appSlug, srvVibeSandbox]);

  // Hydrate the code editor from Apps.fileSystem when no ChatSections
  // exist for this fsId (e.g. a freshly forked vibe). The fetch is
  // content-addressed and HTTP-cacheable. Once a real prompt lands,
  // getCode walks blocks first and this fallback is ignored.
  const hydratedFsIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!fsId || !userSlug || !appSlug) return;
    if (hydratedFsIdsRef.current.has(fsId)) return;
    hydratedFsIdsRef.current.add(fsId);
    (async () => {
      const rApp = await vibeDiyApi.getAppByFsId({ appSlug, userSlug, fsId });
      if (rApp.isErr()) return;
      const app = rApp.Ok();
      const appJsx =
        app.fileSystem.find((f) => f.entryPoint && f.fileName === "/App.jsx") ??
        app.fileSystem.find((f) => f.fileName === "/App.jsx");
      if (!appJsx) return;
      const rRes = await exception2Result(() =>
        fetch(`/assets/cid/?url=${encodeURIComponent(appJsx.assetURI)}&mime=${encodeURIComponent(appJsx.mimeType)}`)
      );
      if (rRes.isErr() || !rRes.Ok().ok) return;
      const text = await rRes.Ok().text();
      dispatch({ type: "setHydratedSource", fsId, code: text.split("\n") });
    })();
  }, [fsId, userSlug, appSlug, vibeDiyApi]);

  useEffect(() => {
    if (inConstruction) return;
    if (openingRef.current) {
      if (chat && promptToSend?.trim().length) {
        const newSearch = new URLSearchParams(searchParams);
        // Default to preview so the user sees the iframe hot-swap as edits
        // stream. Brand-new vibes show a placeholder until end-of-turn
        // autosave creates the first fsId; the iframe then mounts and hot-
        // swap fills in subsequent edits.
        if (!newSearch.has("view")) {
          newSearch.set("view", "preview");
        }
        // Preserve fsId on follow-ups so PreviewApp keeps the iframe mounted
        // and the hot-swap useEffect has the prior buffer to resolve against.
        // Read fsId from the ref so future autosave-driven fsId changes don't
        // re-trigger this effect with the same promptToSend (loop bug).
        const currentFsId = fsIdRef.current;
        const pathname = currentFsId ? `/chat/${userSlug}/${appSlug}/${currentFsId}` : `/chat/${userSlug}/${appSlug}`;
        navigate({ pathname, search: newSearch.toString() }, { replace: true });
        const sentPrompt = promptToSend;
        // Clear promptToSend BEFORE firing so any re-render of this effect
        // (e.g. searchParams change) sees null and skips the branch.
        sendPrompt(null);
        chat
          .prompt({
            messages: [
              {
                role: "user",
                content: [{ type: "text", text: sentPrompt }],
              },
            ],
          })
          .then((r) => {
            if (r.isErr()) {
              console.error(`PromptSend failed`, r.Ok());
            } else {
              console.log(`send prompt`, sentPrompt);
              notifyRecentVibesChanged();
            }
          });
      }
      return; // Already opened or opening
    }
    openingRef.current = true;
    vibeDiyApi.openChat({ userSlug, appSlug, mode: "chat" }).then((rChat) => {
      if (rChat.isErr()) {
        console.error("CHAT-Error", rChat.Err(), userSlug, appSlug);
        return;
      }
      setChat(rChat.Ok());
      dispatch({ type: "initChat", chat: rChat.Ok() });
      vibeDiyApi.ensureAppSettings({ userSlug, appSlug }).then((rS) => {
        if (rS.isOk()) {
          const s = rS.Ok().settings.entry.settings;
          if (s.title) dispatch({ type: "setTitle", title: s.title });
          if (s.icon) dispatch({ type: "setIcon", icon: s.icon });
          if (s.theme) {
            const t = getThemeBySlug(s.theme);
            if (t) dispatch({ type: "setTheme", theme: t });
          }
          if (s.colorTheme) {
            dispatch({ type: "setColorTheme", colorTheme: s.colorTheme });
          }
        }
      });
      void processStream(rChat.Ok().sectionStream, (msg) => {
        const se = sectionEvent(msg);
        if (se instanceof type.errors) {
          console.error(se.summary);
          return;
        }
        for (const block of se.blocks) {
          dispatch(block);
        }
      });
      // For CLI-pushed apps with no chat history, look up the latest fsId
      if (!fsId) {
        vibeDiyApi.getAppByFsId({ appSlug, userSlug }).then((rApp) => {
          if (rApp.isOk() && rApp.Ok().fsId) {
            const sp = new URLSearchParams(searchParams);
            if (!sp.has("view")) sp.set("view", "preview");
            navigate({ pathname: `/chat/${userSlug}/${appSlug}/${rApp.Ok().fsId}`, search: sp.toString() }, { replace: true });
          }
        });
      }
    });
    return () => {
      if (chat) {
        (chat as LLMChat).close();
      }
    };
  }, [userSlug, appSlug, chat, openingRef, vibeDiyApi, promptToSend]);

  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((_view: ViewType, e: React.MouseEvent) => {
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const sandboxUrl =
    fsId && appSlug && userSlug
      ? (() => {
          const myUrl = URI.from(window.location.href);
          return BuildURI.from(
            calcEntryPointUrl({
              hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
              protocol: myUrl.protocol as "http" | "",
              port: myUrl.port,
              bindings: { appSlug, userSlug, fsId },
            })
          )
            .setParam("npmUrl", svcVars.pkgRepos.workspace)
            .setParam("preview", "yes")
            .toString();
        })()
      : undefined;

  const closeSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  const [mobilePreviewShown, setMobilePreviewShown] = useState(false);
  const { navigateToView, viewControls, currentView } = useViewState(promptState, [searchParams, setSearchParams]);

  // During the first codegen of a brand-new chat or remix the UI shows the
  // streaming code editor (with a hidden pre-warming iframe behind it). The
  // displayView reflects what's actually on screen so the header tab
  // highlights "Code" during that window instead of the URL-derived "App".
  const freshFirstCodegen = useFreshFirstCodegen(promptState, fsId);
  const displayView = currentView === "preview" && freshFirstCodegen && promptState.hasCode ? "code" : currentView;

  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  const fsIdClick = useCallback(
    ({ fsId: newFsId }: { fsId: string; appSlug: string; userSlug: string }) => {
      // navigateToView();
      if (!["preview", "code"].includes(currentViewRef.current)) {
        currentViewRef.current = "preview";
      }
      const sp = new URLSearchParams(searchParams);
      sp.set("view", currentViewRef.current);
      if (isMobileViewport()) {
        setMobilePreviewShown(true);
      }
      navigate({ pathname: `/chat/${userSlug}/${appSlug}/${newFsId}`, search: sp.toString() }, { replace: true });
    },
    [navigate, userSlug, appSlug, searchParams]
  );

  const openVibe = useCallback(() => {
    window.open(`/vibe/${userSlug}/${appSlug}/${fsId}`, "_blank");
  }, [fsId, userSlug, appSlug]);

  const handleRetry = useCallback(
    (errorMsg: PromptError) => {
      let promptText: string | undefined = undefined;
      for (const block of promptState.blocks) {
        for (const msg of block.msgs) {
          if (isPromptReq(msg) && msg.chatId === errorMsg.chatId && msg.seq < errorMsg.seq) {
            const text = msg.request.messages
              .filter((m) => m.role === "user")
              .flatMap((m) => m.content.filter((c) => c.type === "text").map((c) => c.text))
              .join("\n");
            if (text.trim()) promptText = text;
          }
        }
      }
      if (promptText) {
        chatInput.current?.setPrompt(promptText);
        sendPrompt(promptText);
      }
    },
    [promptState.blocks, chatInput]
  );

  const [editorState, setEditorState] = useState<EditorState>({
    state: "idle",
  });
  const handleOnCode = useCallback((event: EditorState) => {
    // console.log(`handleOnCode:`, event);
    // if (isEditorStateEdit(event)) {
    setEditorState({ ...event });
    // } else {
    // setEditorState({ state: "idle" });
    // }
  }, []);

  const pendingSavePromptIdRef = useRef<string | null>(null);

  const handleOnCodeSave = useCallback(() => {
    console.log(`Saving code changes...`, editorState);
    if (!chat) return;
    if (!isEditorStateEdit(editorState)) {
      return;
    }
    setEditorState({ state: "idle" });
    chat
      .promptFS([
        {
          type: "code-block",
          filename: "/App.jsx",
          lang: "jsx", // "'jsx'|'js'",
          content: editorState.buffer,
        },
      ])
      .then((r) => {
        if (r.isErr()) {
          toast.error(`Failed to save code changes: ${r.Err().message}`);
          setEditorState(editorState); // restore unsaved state
        } else {
          toast.success(`Code changes saved`);
          pendingSavePromptIdRef.current = r.Ok().promptId;
          console.log(`[CodeSave] waiting for block.end with promptId: ${r.Ok().promptId}`);
          notifyRecentVibesChanged();
        }
      });
  }, [editorState, chat]);

  // Navigate to new fsId after save by watching promptState for the block.end matching the save's promptId
  useEffect(() => {
    if (!pendingSavePromptIdRef.current) return;
    const targetPromptId = pendingSavePromptIdRef.current;
    for (const block of [...promptState.blocks].reverse()) {
      for (const msg of block.msgs) {
        if (isBlockEnd(msg) && msg.streamId === targetPromptId && msg.fsRef) {
          pendingSavePromptIdRef.current = null;
          const sp = new URLSearchParams(searchParams);
          if (!sp.has("view")) sp.set("view", "preview");
          console.log(`[CodeSave] navigating to new fsId: ${msg.fsRef.fsId} (promptId: ${targetPromptId})`);
          navigate({ pathname: `/chat/${userSlug}/${appSlug}/${msg.fsRef.fsId}`, search: sp.toString() }, { replace: true });
          return;
        }
      }
    }
  }, [promptState.blocks, searchParams, navigate, userSlug, appSlug, fsId]);

  // Clear pending save when switching chats
  useEffect(() => {
    pendingSavePromptIdRef.current = null;
  }, [userSlug, appSlug]);

  // Brand-new app first-paint: when the server persists the first (create-only)
  // scaffold block it emits block.end with fsRef.fsId. If we still have no fsId
  // in the URL, navigate to it so the iframe can load immediately rather than
  // waiting for end-of-turn autosave (which only fires for SEARCH/REPLACE
  // turns). The server-side resolver merges and persists App.jsx on each LLM
  // turn's block.end and stamps fsRef on that block, so at end-of-stream we
  // point the URL at the most recent fsRef.
  //
  // Only fires on a running:true→false transition. Without that gate, the
  // effect would run for every promptState.blocks mutation — including the
  // initial server-replay of an old chat — and yank the user off whatever
  // historical fsId they intentionally opened.
  const lastNavigatedFsIdRef = useRef<string | undefined>(fsId);
  const navWasRunningRef = useRef(false);
  useEffect(() => {
    const justEnded = navWasRunningRef.current && !promptState.running;
    navWasRunningRef.current = promptState.running;
    if (!justEnded) return;
    for (let i = promptState.blocks.length - 1; i >= 0; i -= 1) {
      const block = promptState.blocks[i];
      for (const msg of block.msgs) {
        if (isBlockEnd(msg) && msg.fsRef) {
          const newFsId = msg.fsRef.fsId;
          if (newFsId !== lastNavigatedFsIdRef.current) {
            lastNavigatedFsIdRef.current = newFsId;
            const sp = new URLSearchParams(searchParams);
            if (!sp.has("view")) sp.set("view", "preview");
            navigate({ pathname: `/chat/${userSlug}/${appSlug}/${newFsId}`, search: sp.toString() }, { replace: true });
          }
          return;
        }
      }
    }
  }, [promptState.running, promptState.blocks, searchParams, navigate, userSlug, appSlug]);

  // Clear the chat input when a stream ends so a new prompt starts blank.
  useEffect(() => {
    if (inConstruction) return;
    if (!promptState.running && chatInput.current) {
      chatInput.current.setPrompt("");
    }
  }, [promptState.running, inConstruction]);

  // On mobile (chat and preview not visible simultaneously), stay on chat
  // view while the LLM is planning so the user can watch the explanation
  // stream in, then auto-flip to preview when the FIRST code block of the
  // current stream begins. Resets per running cycle so follow-up prompts
  // also see the chat→preview transition (hasCode would stay true forever
  // once first set, and miss the second turn's code-begin entirely).
  const sawCodeBeginThisRunRef = useRef(false);
  useEffect(() => {
    if (inConstruction) return;
    if (!promptState.running) {
      sawCodeBeginThisRunRef.current = false;
      return;
    }
    if (sawCodeBeginThisRunRef.current) return;
    const last = promptState.blocks[promptState.blocks.length - 1];
    if (last === undefined) return;
    if (!last.msgs.some((m) => isCodeBegin(m))) return;
    sawCodeBeginThisRunRef.current = true;
    if (isMobileViewport()) {
      setMobilePreviewShown(true);
    }
  }, [promptState.running, promptState.blocks, inConstruction]);

  // console.log(`Rendering Chat with state:`, { currentView, editorState: editorState.state });

  return (
    <>
      <AppLayout
        isSidebarVisible={isSidebarVisible}
        setIsSidebarVisible={setIsSidebarVisible}
        fullWidthChat={isMobileViewport()}
        headerLeft={
          <ChatHeaderContent
            remixOf={remixOf}
            promptProcessing={promptState.running}
            codeReady={promptState.hasCode}
            title={promptState.title}
            icon={promptState.icon}
          />
        }
        headerRight={
          <ResultPreviewHeaderContent
            promptState={promptState}
            navigateToView={navigateToView}
            viewControls={viewControls}
            currentView={displayView}
            onCodeSave={handleOnCodeSave}
            hasCodeChanges={isEditorStateEdit(editorState) && editorState.buffer.trim().length > 0}
            openVibe={openVibe}
            onContextMenu={handleContextMenu}
            shareModal={shareModal}
            pendingRequestCount={isOwner ? pendingCount : 0}
            onBackClick={() => setMobilePreviewShown(false)}
            isOwner={isOwner}
            myGrant={isOwner ? "owner" : "none"}
          />
        }
        chatPanel={
          <ChatInterface promptState={promptState} onClick={fsIdClick} onRetry={handleRetry} onSelectOption={handleSelectOption} />
        }
        previewPanel={<ResultPreview promptState={promptState} currentView={currentView} onCode={handleOnCode} />}
        chatInput={
          <BrutalistCard size="md" style={{ margin: "0 1rem 1rem 1rem" }}>
            <ChatInput
              ref={chatInput}
              onSubmit={sendPrompt}
              promptProcessing={promptState.running}
              hasCode={promptState.hasCode}
              currentMsgCount={promptState.current?.msgs.length ?? 0}
              selectedTheme={promptState.theme ?? null}
              onThemeButtonClick={() => setThemeModalOpen(true)}
              paletteOptions={vibesThemes}
              selectedPaletteSlug={promptState.colorTheme ?? promptState.theme?.slug ?? undefined}
              onSelectPalette={handlePaletteSelect}
              onApplyLivePalette={handleApplyLivePalette}
              onResetPalette={handlePaletteReset}
              onRegeneratePalette={handlePaletteRegenerate}
            />
          </BrutalistCard>
        }
        suggestionsComponent={undefined}
        mobilePreviewShown={mobilePreviewShown}
      />
      <Delayed ms={1000}>
        <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} />
      </Delayed>
      {contextMenu && (
        <VibeAppContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          vibeHref={`/vibe/${userSlug}/${appSlug}/${fsId}`}
          sandboxUrl={sandboxUrl}
          onClose={() => setContextMenu(null)}
        />
      )}
      <ThemePickerModal
        open={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
        onSelect={handleThemeSelect}
        selectedSlug={promptState.theme?.slug}
        themes={vibesThemes}
      />
    </>
  );
}

export default Chat;
