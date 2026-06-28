import { useNavigate, useParams, useSearchParams } from "react-router";
import React, { useEffect, useState, useReducer, useRef, useCallback } from "react";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { useAuth } from "@clerk/react";
import { BuildURI, URI } from "@adviser/cement";
import type { ViewType, VibesTheme } from "@vibes.diy/prompts";
import { vibesThemes, getThemeBySlug } from "@vibes.diy/prompts";
import { isPromptReq, LLMChatEntry, PromptError } from "@vibes.diy/api-types";
import { promptReducer } from "./prompt-state.js";

// Re-export so existing importers of these types from the route keep compiling.
export type { PromptState, PromptBlock, HydratedCodeViewFile } from "./prompt-state.js";
import AppLayout from "../../components/AppLayout.js";
import { BrutalistCard } from "@vibes.diy/base";
import SessionSidebar from "../../components/SessionSidebar.js";
import ChatInput, { ChatInputRef } from "../../components/ChatInput.js";
import ThemePickerModal from "../../components/ThemePickerModal.js";
import { isMobileViewport, useViewState } from "../../utils/ViewState.js";
import { useIframeCurrentTokens } from "../../hooks/useIframeCurrentTokens.js";
import { useFreshFirstCodegen } from "../../utils/freshFirstCodegen.js";
import { shouldAcceptPrompt } from "../../utils/submit-guard.js";
import { useChatNavigation } from "../../hooks/useChatNavigation.js";
import { useChatOwnership } from "../../hooks/useChatOwnership.js";
import { useChatHydration } from "../../hooks/useChatHydration.js";
import { useMobilePreviewFlip } from "../../hooks/useMobilePreviewFlip.js";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import ChatHeaderContent from "../../components/ChatHeaderContent.js";
import { useYoursNowToast } from "../../hooks/use-yours-now-toast.js";
import ChatInterface from "../../components/ChatInterface.js";
import { ResultPreviewHeaderContent } from "../../components/ResultPreview/ResultPreviewHeaderContent.js";
import { useShareModal } from "../../components/ResultPreview/useShareModal.js";
import ResultPreview from "../../components/ResultPreview/ResultPreview.js";
import { Delayed } from "../../components/Delayed.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { useChatSession } from "../../hooks/useChatSession.js";
import { notifyRecentVibesChanged, subscribeRecentVibesChanged } from "../../hooks/useRecentVibes.js";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import { EditorState, isEditorStateEdit } from "../../types/code-editor.js";
import { inferCodeViewLanguage, normalizeCodeViewPath } from "../../components/ResultPreview/code-view-files.js";

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

export function Chat({ inConstruction = false, initialPrompt }: { inConstruction?: boolean; initialPrompt?: string }) {
  const {
    ownerHandle = "preparing",
    appSlug = "session",
    fsId,
  } = useParams<{ ownerHandle: string; appSlug: string; fsId?: string }>();
  useDocumentTitle(`${ownerHandle} - ${appSlug} - vibes.diy`);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { chatApi, sharedApi, webVars: svcVars, srvVibeSandbox, sthis } = useVibesDiy();
  const shareModal = useShareModal({
    ownerHandle,
    appSlug,
    fsId,
    chatApi,
    sharedApi,
    hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
  });
  const { isSignedIn } = useAuth();
  const { isOwner, pendingCount } = useChatOwnership({
    ownerHandle,
    appSlug,
    isSignedIn,
    sharedApi,
    shareModalOpen: shareModal.isOpen,
  });

  const [promptToSend, sendPrompt] = useState<string | null>(null);
  // True from the moment a turn is accepted until the stream's first block
  // flips promptState.running true (or the send settles/errors). Closes the
  // click→first-block window where neither promptToSend nor running is truthy.
  const [submitting, setSubmitting] = useState(false);
  const pendingSubmitResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const chatInput = useRef<ChatInputRef>(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  const [promptState, dispatch] = useReducer(promptReducer, {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: appSlug,
    blocks: [],
    searchParams,
    setSearchParams,
    agentSavedBlockIds: new Set<string>(),
    connection: "live",
  });

  const settlePendingSubmit = useCallback((ok: boolean) => {
    const resolvePending = pendingSubmitResolveRef.current;
    if (!resolvePending) return;
    pendingSubmitResolveRef.current = null;
    resolvePending(ok);
  }, []);

  // Single guarded entry point shared by the suggestion chips and the text
  // input. Sets `submitting` on accept so the composer reports busy instantly,
  // before the stream's first block flips promptState.running true.
  const submitPrompt = useCallback(
    (text: string): Promise<boolean> => {
      if (inConstruction) return Promise.resolve(false);
      if (!shouldAcceptPrompt({ text, submitting, running: promptState.running })) return Promise.resolve(false);
      // Best effort safety: if a previous submit promise is somehow still
      // pending, resolve it as failed before replacing it.
      settlePendingSubmit(false);
      return new Promise<boolean>((resolve) => {
        pendingSubmitResolveRef.current = resolve;
        setSubmitting(true);
        sendPrompt(text);
      });
    },
    [inConstruction, submitting, promptState.running, sendPrompt, settlePendingSubmit]
  );

  const handleSelectOption = useCallback((option: string) => submitPrompt(option), [submitPrompt]);

  // Primary reset: once the stream starts, `running` carries the busy signal.
  useEffect(() => {
    if (promptState.running) setSubmitting(false);
  }, [promptState.running]);

  // Bridge the chat-session firing result back into the submit guard: success
  // keeps `submitting` latched until `running` flips (via the effect above);
  // failure releases it immediately and resolves the pending submit promise so
  // a clicked chip can unlock.
  const onSendSettled = useCallback(
    (ok: boolean) => {
      settlePendingSubmit(ok);
      if (!ok) setSubmitting(false);
    },
    [settlePendingSubmit]
  );

  // Single owner of "navigate to fsId" plus the post-save / first-paint
  // block-scanning navigation effects (and their guard refs).
  const { navigateToFsId, onSaveQueued } = useChatNavigation({
    ownerHandle,
    appSlug,
    fsId,
    promptState,
    searchParams,
    navigate,
  });

  // "remix of" indicator + code-view file-system hydration for the current fsId.
  const { remixOf } = useChatHydration({ ownerHandle, appSlug, fsId, sharedApi, dispatch });

  // One-time "it's yours now" message when landing here from a fresh remix (#1856).
  useYoursNowToast();

  // Chat handle + open/fire lifecycle + reconnect/watchdog (see useChatSession).
  const { chat } = useChatSession({
    ownerHandle,
    appSlug,
    fsId,
    inConstruction,
    chatApi,
    sharedApi,
    promptState,
    dispatch,
    promptToSend,
    sendPrompt,
    navigateToFsId,
    onSendSettled,
  });

  useEffect(() => {
    return subscribeRecentVibesChanged((change) => {
      if (change?.ownerHandle !== ownerHandle || change.appSlug !== appSlug || change.title === undefined) return;
      dispatch({ type: "setTitle", title: change.title.length > 0 ? change.title : appSlug });
    });
  }, [ownerHandle, appSlug]);

  // Render the construction-time prompt (e.g. the decoded ?prompt64 from
  // /chat/prompt) as an optimistic user bubble immediately, so the message is
  // visible while the "Preparing AI Session…" overlay is still up — before any
  // chat is opened or the server echoes prompt.req back.
  useEffect(() => {
    if (!initialPrompt) return;
    dispatch({ type: "setOptimisticPrompt", text: initialPrompt });
  }, [initialPrompt, dispatch]);

  // Pre-fill the composer from an incoming ?prompt64. The /vibe route's
  // suggestion chips and "describe a change" box hand off here (#2675) by
  // navigating to /chat/$owner/$app?prompt64=<encoded>. We SEED the input
  // rather than auto-submit — the user reviews and taps send, which is
  // lower-risk than firing a turn on navigation. Strip the param after so a
  // reload doesn't re-seed over a half-typed message. inConstruction is the
  // /chat/prompt create flow, which consumes prompt64 itself (initialPrompt).
  useEffect(() => {
    if (inConstruction) return;
    const prompt64 = searchParams.get("prompt64");
    if (!prompt64) return;
    const decoded = sthis.txt.base64.decode(prompt64);
    if (decoded) {
      chatInput.current?.setPromptIfEmpty(decoded);
      chatInput.current?.setFocus();
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("prompt64");
        return next;
      },
      { replace: true }
    );
  }, [inConstruction, searchParams, setSearchParams, sthis]);

  // Clear stale messages immediately when navigating to a different chat so
  // the old conversation is not visible while the new one loads.
  const prevChatKeyRef = useRef(`${ownerHandle}/${appSlug}`);
  useEffect(() => {
    const key = `${ownerHandle}/${appSlug}`;
    if (key !== prevChatKeyRef.current) {
      prevChatKeyRef.current = key;
      dispatch({ type: "clearChat", appSlug });
      // A submit accepted in the previous chat but not yet handed off to
      // `running` would otherwise leave `submitting` latched on this (persisted)
      // component — the success-path reset only fires when running flips true,
      // which the old turn never does here once we've navigated away. Release
      // it on chat change so the new chat's composer stays interactive.
      settlePendingSubmit(false);
      setSubmitting(false);
    }
  }, [ownerHandle, appSlug, dispatch, settlePendingSubmit]);

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
      const canPersist = isCatalog && ownerHandle !== "preparing" && appSlug !== "session";
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
          void sharedApi.ensureAppSettings({ ownerHandle, appSlug, theme: theme.slug });
        }
        return;
      }
      // Wait for the theme to land in app_settings before kicking off the
      // restyle turn — the server builds the prompt by reading the active
      // theme, so submitting while ensureAppSettings is in flight can
      // process the turn against the previous theme.
      void sharedApi.ensureAppSettings({ ownerHandle, appSlug, theme: theme.slug }).then((res) => {
        if (res.isErr()) return;
        chatInput.current?.clickSubmit();
      });
    },
    [sharedApi, ownerHandle, appSlug]
  );

  // Persist a palette choice (slug only) so future codegen turns and page
  // reloads honor it. Live recolor is handled separately by handleApplyLive
  // — the picker calls both on swatch click so the user sees the swap and
  // the choice survives a refresh.
  const handlePaletteSelect = useCallback(
    (colorTheme: string) => {
      dispatch({ type: "setColorTheme", colorTheme });
      if (ownerHandle !== "preparing" && appSlug !== "session") {
        void sharedApi.ensureAppSettings({ ownerHandle, appSlug, colorTheme });
      }
    },
    [sharedApi, ownerHandle, appSlug]
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
    (paletteSlug: string, paletteName: string, rootCssBlock: string) => {
      dispatch({ type: "setColorTheme", colorTheme: paletteSlug });
      const canPersist = ownerHandle !== "preparing" && appSlug !== "session";
      // Embed the literal :root block in the user message — sending only the
      // palette name (or only the system-prompt design.md) left the LLM
      // interpreting the palette description from training data and inventing
      // hex values. The literal block is the operative instruction the model
      // sees most recently, so prose can't override it.
      const prompt = `Update the styles to use the "${paletteName}" palette.

Copy this \`<style>\` block VERBATIM into the app (replace any existing :root block). Do not change hex values, do not round, do not invent a dark-mode block if none is shown below. Reference every variable via \`bg-[var(--token)]\` / \`text-[var(--token)]\` / \`border-[var(--token)]\` — no inline hex literals.

\`\`\`html
<style>
${rootCssBlock}
</style>
\`\`\``;
      const prefilled = chatInput.current?.setPromptIfEmpty(prompt) ?? false;
      chatInput.current?.setFocus();
      if (!canPersist || !prefilled) {
        if (canPersist) {
          void sharedApi.ensureAppSettings({ ownerHandle, appSlug, colorTheme: paletteSlug });
        }
        return;
      }
      void sharedApi.ensureAppSettings({ ownerHandle, appSlug, colorTheme: paletteSlug }).then((res) => {
        if (res.isErr()) return;
        chatInput.current?.clickSubmit();
      });
    },
    [sharedApi, ownerHandle, appSlug]
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
    if (ownerHandle !== "preparing" && appSlug !== "session") {
      void sharedApi.ensureAppSettings({ ownerHandle, appSlug, colorTheme: null });
    }
  }, [sharedApi, ownerHandle, appSlug, srvVibeSandbox]);

  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((_view: ViewType, e: React.MouseEvent) => {
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const sandboxUrl =
    fsId && appSlug && ownerHandle
      ? (() => {
          const myUrl = URI.from(window.location.href);
          return BuildURI.from(
            calcEntryPointUrl({
              hostnameBase: svcVars.env.VIBES_SVC_HOSTNAME_BASE,
              protocol: myUrl.protocol as "http" | "",
              port: myUrl.port,
              bindings: { appSlug, ownerHandle, fsId },
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

  // Tokens the running app declares on `:root`. The palette picker uses these
  // so the user can edit and remap any custom property the app actually has —
  // including bespoke ones like `--gold-base` that the canonical palette set
  // doesn't include.
  const iframeCurrentTokens = useIframeCurrentTokens();

  // During the first codegen of a brand-new chat or remix the UI shows the
  // streaming code editor (with a hidden pre-warming iframe behind it). The
  // displayView reflects what's actually on screen so the header tab
  // highlights "Code" during that window instead of the URL-derived "App".
  const freshFirstCodegen = useFreshFirstCodegen(promptState, fsId);
  const displayView = currentView === "preview" && freshFirstCodegen && promptState.hasCode ? "code" : currentView;

  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  const fsIdClick = useCallback(
    ({ fsId: newFsId }: { fsId: string; appSlug: string; ownerHandle: string }) => {
      // navigateToView();
      if (!["preview", "code"].includes(currentViewRef.current)) {
        currentViewRef.current = "preview";
      }
      const sp = new URLSearchParams(searchParams);
      sp.set("view", currentViewRef.current);
      if (isMobileViewport()) {
        setMobilePreviewShown(true);
      }
      navigate({ pathname: `/chat/${ownerHandle}/${appSlug}/${newFsId}`, search: sp.toString() }, { replace: true });
    },
    [navigate, ownerHandle, appSlug, searchParams]
  );

  const [diffOverlay, setDiffOverlay] = useState<{ path: string; lines: string[] } | null>(null);

  const handleDiffClick = useCallback(
    (diff: { path: string; lines: string[] } | null) => {
      setDiffOverlay(diff);
      if (diff && !["code"].includes(currentViewRef.current)) {
        currentViewRef.current = "code";
        const sp = new URLSearchParams(searchParams);
        sp.set("view", "code");
        if (isMobileViewport()) {
          setMobilePreviewShown(true);
        }
        navigate({ search: sp.toString() }, { replace: true });
      }
    },
    [navigate, searchParams]
  );

  const openVibe = useCallback(() => {
    window.open(`/vibe/${ownerHandle}/${appSlug}/${fsId}`, "_blank");
  }, [fsId, ownerHandle, appSlug]);

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
        void submitPrompt(promptText);
      }
    },
    [promptState.blocks, chatInput, submitPrompt]
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

  const handleOnCodeSave = useCallback(() => {
    console.log(`Saving code changes...`, editorState);
    if (!chat) return;
    if (!isEditorStateEdit(editorState)) {
      return;
    }
    setEditorState({ state: "idle" });
    const filename = normalizeCodeViewPath(editorState.filePath || "/App.jsx");
    const lang = editorState.lang || inferCodeViewLanguage(filename, "text/javascript");
    chat
      .promptFS({
        update: [
          {
            type: "code-block",
            filename,
            lang,
            content: editorState.buffer,
          },
        ],
        remove: [],
      })
      .then((r) => {
        if (r.isErr()) {
          toast.error(`Failed to save code changes: ${r.Err().message}`);
          setEditorState(editorState); // restore unsaved state
        } else {
          toast.success(`Code changes saved`);
          onSaveQueued(r.Ok().promptId);
          dispatch({ type: "setInFlightStreamId", streamId: r.Ok().promptId });
          console.log(`[CodeSave] waiting for block.end with promptId: ${r.Ok().promptId}`);
          notifyRecentVibesChanged();
        }
      });
  }, [editorState, chat, onSaveQueued]);

  // Clear the chat input when a stream ends so a new prompt starts blank.
  useEffect(() => {
    if (inConstruction) return;
    if (!promptState.running && chatInput.current) {
      chatInput.current.setPrompt("");
    }
  }, [promptState.running, inConstruction]);

  // On mobile, auto-flip from chat to preview when the first code block of the
  // current stream begins (see useMobilePreviewFlip).
  useMobilePreviewFlip({ promptState, inConstruction, setMobilePreviewShown });

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
          <ChatInterface
            promptState={promptState}
            onClick={fsIdClick}
            onDiffClick={handleDiffClick}
            onRetry={handleRetry}
            onSelectOption={handleSelectOption}
            optimisticPrompt={promptState.optimisticPrompt}
          />
        }
        previewPanel={
          <ResultPreview promptState={promptState} currentView={currentView} onCode={handleOnCode} diffOverlay={diffOverlay} />
        }
        chatInput={
          <BrutalistCard size="md" style={{ margin: "0 1rem 1rem 1rem" }}>
            <ChatInput
              ref={chatInput}
              onSubmit={submitPrompt}
              promptProcessing={submitting || promptState.running}
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
              paletteStorageKey={
                ownerHandle !== "preparing" && appSlug !== "session" ? `vibes-overrides:${ownerHandle}/${appSlug}` : undefined
              }
              paletteCurrentTokens={iframeCurrentTokens}
              connectionState={promptState.connection}
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
          vibeHref={`/vibe/${ownerHandle}/${appSlug}/${fsId}`}
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
