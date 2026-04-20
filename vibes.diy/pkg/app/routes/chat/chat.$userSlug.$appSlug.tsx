import { SetURLSearchParams, useNavigate, useParams, useSearchParams } from "react-router";
import React, { useEffect, useState, useReducer, useRef, useCallback } from "react";
import { useVibesDiy } from "../../vibes-diy-provider.js";
// import { useClerk } from "@clerk/react";
import { processStream, BuildURI, URI } from "@adviser/cement";
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
import { isMobileViewport, useViewState } from "../../utils/ViewState.js";
import type { ViewType } from "@vibes.diy/prompts";
import { isCodeBegin, isBlockEnd } from "@vibes.diy/call-ai-v2";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";
import ChatHeaderContent from "../../components/ChatHeaderContent.js";
import ChatInterface from "../../components/ChatInterface.js";
import { ResultPreviewHeaderContent } from "../../components/ResultPreview/ResultPreviewHeaderContent.js";
import { useShareModal } from "../../components/ResultPreview/useShareModal.js";
import ResultPreview from "../../components/ResultPreview/ResultPreview.js";
import { Delayed } from "../../components/Delayed.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
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

type PromptAction = PromptAndBlockMsgs | InitChat | SetTitle;

function promptReducer(state: PromptState, block: PromptAction): PromptState {
  switch (true) {
    case isInitChat(block):
      // console.log(`initChat`, block.chat)
      return { ...state, chat: block.chat };

    case isSetTitle(block):
      return { ...state, title: block.title };

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
  const { vibeDiyApi, webVars: svcVars } = useVibesDiy();
  const shareModal = useShareModal({ userSlug, appSlug, fsId, vibeDiyApi });

  const [promptToSend, sendPrompt] = useState<string | null>(null);
  const chatInput = useRef<ChatInputRef>(null);

  const [promptState, dispatch] = useReducer(promptReducer, {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: appSlug,
    blocks: [],
    searchParams,
    setSearchParams,
  });

  useEffect(() => {
    if (inConstruction) return;
    if (openingRef.current) {
      if (chat && promptToSend?.trim().length) {
        const newSearch = new URLSearchParams(searchParams);
        if (!newSearch.has("view")) {
          newSearch.set("view", "code");
        }
        navigate({ pathname: `/chat/${userSlug}/${appSlug}`, search: newSearch.toString() }, { replace: true });
        console.log(`promptToSend:`);
        chat
          .prompt({
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: promptToSend,
                  },
                ],
              },
            ],
          })
          .then((r) => {
            if (r.isErr()) {
              console.error(`PromptSend failed`, r.Ok());
            } else {
              console.log(`send prompt`, promptToSend);
            }
          });
        // .finally(() => sendPrompt(null) /* avoid double send */);
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
          const t = rS.Ok().settings.entry.settings.title;
          if (t) dispatch({ type: "setTitle", title: t });
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
      // console.log(`fsIdClick`, { newFsId, appSlug, userSlug, searchParams: sp.toString(), currentView: currentViewRef.current });
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

  useEffect(() => {
    if (inConstruction) return;
    if (isMobileViewport()) {
      setMobilePreviewShown(true);
    }
    if (!promptState.running && chatInput.current) {
      chatInput.current.setPrompt("");
      return;
    }
    // if (promptState.current)
  }, [promptState.running]);

  // console.log(`Rendering Chat with state:`, { currentView, editorState: editorState.state });

  return (
    <>
      <AppLayout
        isSidebarVisible={isSidebarVisible}
        setIsSidebarVisible={setIsSidebarVisible}
        fullWidthChat={isMobileViewport()}
        headerLeft={
          <ChatHeaderContent
            remixOf={/*chatState.vibeDoc?.remixOf*/ undefined}
            promptProcessing={promptState.running}
            codeReady={promptState.hasCode}
            title={promptState.title}
          />
        }
        headerRight={
          <ResultPreviewHeaderContent
            promptState={promptState}
            navigateToView={navigateToView}
            viewControls={viewControls}
            currentView={currentView}
            onCodeSave={handleOnCodeSave}
            hasCodeChanges={isEditorStateEdit(editorState) && editorState.buffer.trim().length > 0}
            openVibe={openVibe}
            onContextMenu={handleContextMenu}
            shareModal={shareModal}
          />
        }
        chatPanel={<ChatInterface promptState={promptState} onClick={fsIdClick} onRetry={handleRetry} />}
        previewPanel={<ResultPreview promptState={promptState} currentView={currentView} onCode={handleOnCode} />}
        chatInput={
          <BrutalistCard size="md" style={{ margin: "0 1rem 1rem 1rem" }}>
            <ChatInput ref={chatInput} onSubmit={sendPrompt} promptProcessing={promptState.running} />
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
    </>
  );
}

export default Chat;
