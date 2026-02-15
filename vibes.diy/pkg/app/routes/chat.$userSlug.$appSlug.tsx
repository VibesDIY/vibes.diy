import { useParams, useSearchParams } from "react-router";
import React, { useEffect, useState, useReducer, useRef, useCallback } from "react";
import { LLMChat, LLMChatEntry } from "@vibes.diy/api-impl";
import { useVibeDiy } from "../vibe-diy-provider.js";
import { useClerk } from "@clerk/clerk-react";
import { consumeStream } from "@adviser/cement";
import { PromptAndBlockMsgs, sectionEvent } from "@vibes.diy/api-types";
import { type } from "arktype";
import AppLayout from "../components/AppLayout.js";
import { BrutalistCard } from "../components/vibes/BrutalistCard.js";
import SessionSidebar from "../components/SessionSidebar.js";
import ChatInput, { ChatInputRef } from "../components/ChatInput.js";
import { featuredModels } from "../data/models.js";
import { isMobileViewport, useViewState } from "../utils/ViewState.js";
import { isCodeBegin, isPromptBlockBegin, isPromptBlockEnd } from "@vibes.diy/call-ai-v2";
import ChatHeaderContent from "../components/ChatHeaderContent.js";
import ChatInterface from "../components/ChatInterface.js";
import ResultPreviewHeaderContent from "../components/ResultPreview/ResultPreviewHeaderContent.js";
import ResultPreview from "../components/ResultPreview/ResultPreview.js";

export interface PromptState {
  chat: LLMChatEntry;
  running: boolean;
  current?: PromptBlock;
  blocks: PromptBlock[];
  hasCode: boolean;
  title: string;
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

type PromptAction = PromptAndBlockMsgs | InitChat;

function promptReducer(state: PromptState, block: PromptAction): PromptState {
  switch (true) {
    case isInitChat(block):
      // console.log(`initChat`, block.chat)
      return { ...state, chat: block.chat };

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
      return {
        ...state,
        current: { ...state.current, msgs: [...state.current.msgs, block] },
        blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, msgs: [...b.msgs, block] } : b)),
      };
  }
}

export default function Chat() {
  const { userSlug, appSlug } = useParams<{ userSlug: string; appSlug: string }>();
  const [_, setSearchParam] = useSearchParams();
  const [chat, setChat] = useState<LLMChat | null>(null);
  const openingRef = useRef(false);
  const { vibeDiyApi } = useVibeDiy();
  const clerk = useClerk();

  const [promptToSend, sendPrompt] = useState<string | null>(null);
  const chatInput = useRef<ChatInputRef>(null);

  const [promptState, dispatch] = useReducer(promptReducer, {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: "Title-Feature-Missing",
    blocks: [],
  });

  useEffect(() => {
    if (!clerk.isSignedIn) {
      return;
    }
    if (chat || openingRef.current) {
      setSearchParam((prev) => {
        prev.delete("sectionId");
        prev.set("view", "code");
        return prev;
      });
      if (chat && promptToSend?.trim().length) {
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
    vibeDiyApi.openChat({ userSlug, appSlug }).then((rChat) => {
      if (rChat.isErr()) {
        console.error("CHAT-Error", rChat.Err(), userSlug, appSlug);
        return;
      }
      console.log("Chat", rChat.Ok());
      setChat(rChat.Ok());
      // console.log(`dispatch-initChat`, rChat.Ok())
      dispatch({ type: "initChat", chat: rChat.Ok() });
      consumeStream(rChat.Ok().sectionStream, (msg) => {
        const se = sectionEvent(msg);
        if (se instanceof type.errors) {
          console.error(se.summary);
          return;
        }
        for (const block of se.blocks) {
          // console.log("recv-block", block)
          dispatch(block);
        }
      });
    });
  }, [userSlug, appSlug, clerk.isSignedIn, chat, vibeDiyApi, promptToSend]);

  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  const openSidebar = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  const [mobilePreviewShown, setMobilePreviewShown] = useState(false);
  const { navigateToView, viewControls, currentView } = useViewState(promptState);

  useEffect(() => {
    if (isMobileViewport()) {
      setMobilePreviewShown(true);
    }
    if (!promptState.running && chatInput.current) {
      chatInput.current.setPrompt("");
      return;
    }
    // if (promptState.current)
  }, [promptState.running]);

  if (!clerk.isSignedIn) {
    return <>Waiting to sign in</>;
  }

  return (
    <>
      <AppLayout
        fullWidthChat={isMobileViewport()}
        headerLeft={
          <ChatHeaderContent
            remixOf={/*chatState.vibeDoc?.remixOf*/ undefined}
            onOpenSidebar={openSidebar}
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
            hasCodeChanges={false}
          />
        }
        chatPanel={<ChatInterface promptState={promptState} />}
        previewPanel={<ResultPreview promptState={promptState} currentView={currentView} />}
        chatInput={
          <BrutalistCard size="md" style={{ margin: "0 1rem 1rem 1rem" }}>
            <ChatInput ref={chatInput} models={featuredModels} onSubmit={sendPrompt} promptProcessing={promptState.running} />
          </BrutalistCard>
        }
        suggestionsComponent={undefined}
        mobilePreviewShown={mobilePreviewShown}
      />
      <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} />
    </>
  );
}

//            <ResultPreviewHeaderContent
//   displayView={displayView as ViewType}
//   navigateToView={navigateToView as (view: ViewType) => void}
//   viewControls={viewControls as ViewControlsType}
//   showViewControls={!!showViewControls}
//   setMobilePreviewShown={setMobilePreviewShown}
//   setUserClickedBack={setUserClickedBack} // Keep this for BackButton logic
//   promptProcessing={chatState.promptProcessing}
//   // Props needed by usePublish and useSession within ResultPreviewHeaderContent:
//   code={/*chatState.selectedCode?.content || */ ""}
//   // chat={chatState.chat} // sessionId is guaranteed non-null from interface
//   title={chatState.title} // Handle null
//   previewReady={previewReady} // needed for publish button visibility logic
//   // Props for code editing
//   hasCodeChanges={hasCodeChanges}
//   onCodeSave={codeSaveHandler || undefined}
//   syntaxErrorCount={syntaxErrorCount}
// />

// // Only render the header content when we have code content or a completed session
//         // chatState.selectedCode?.content || sessionId ? (
//         <ResultPreviewHeaderContent
//           displayView={displayView as ViewType}
//           navigateToView={navigateToView as (view: ViewType) => void}
//           viewControls={viewControls as ViewControlsType}
//           showViewControls={!!showViewControls}
//           setMobilePreviewShown={setMobilePreviewShown}
//           setUserClickedBack={setUserClickedBack} // Keep this for BackButton logic
//           promptProcessing={chatState.promptProcessing}
//           // Props needed by usePublish and useSession within ResultPreviewHeaderContent:
//           code={/*chatState.selectedCode?.content || */ ""}
//           // chat={chatState.chat} // sessionId is guaranteed non-null from interface
//           title={chatState.title} // Handle null
//           previewReady={previewReady} // needed for publish button visibility logic
//           // Props for code editing
//           hasCodeChanges={hasCodeChanges}
//           onCodeSave={codeSaveHandler || undefined}
//           syntaxErrorCount={syntaxErrorCount}
//         />

//  <ResultPreview
//             title={chatState.title}
//             setTitle={chatState.setTitle}
//             chat={chatState.chat}
//             // sessionId={chatState.sessionId} // sessionId is guaranteed non-null from interface
//             code={""}
//             promptProcessing={chatState.promptProcessing}
//             codeReady={chatState.hasCode}
//             onScreenshotCaptured={chatState.setScreenshot}
//             displayView={displayView as ViewType}
//             onPreviewLoaded={handlePreviewLoaded}
//             setMobilePreviewShown={setMobilePreviewShown}
//             setIsIframeFetching={setIsIframeFetching}
//             addError={(error) => chatState.setError(error)}
//             onCodeSave={handleCodeSave}
//             onCodeChange={handleCodeChange}
//             onSyntaxErrorChange={handleSyntaxErrorChange}
//           />

//  <ChatInput
//       ref={chatInputRef}
//       chatState={{
//         ...chatState,
//         docs: [],
//         // sendMessage: () => { throw new Error("sendMessage") },
//         saveCodeAsAiMessage: () => {
//           throw new Error("saveCodeAsAiMessage");
//         },
//         immediateErrors: [],
//         advisoryErrors: [],
//         setSelectedResponseId: () => {
//           throw new Error("setSelectedResponseId");
//         },
//         addError: chatState.setError,
//       }}
//       showModelPickerInChat={false /*chatState.showModelPickerInChat */}
//       // currentModel={effectiveModel}
//       onModelChange={async (modelId: string) => {
//         chatState.setModel(modelId);
//         // if (chatState.updateSelectedModel) {
//         // await chatState.updateSelectedModel(modelId);
//         // }
//       }}
//       models={featuredModels}
//       // globalModel={chatState.globalModel}
//       onSend={() => {
//         setMessageHasBeenSent(true);
//       }}
//     />
