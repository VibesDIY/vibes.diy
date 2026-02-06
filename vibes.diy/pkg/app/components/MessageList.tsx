import React, { memo, useCallback } from "react";
// import type { ChatMessageDocument, ViewType } from "@vibes.diy/prompts";
import { PromptBlock } from "../routes/chat.$userSlug.$appSlug.js";
import {
  CodeBeginMsg,
  CodeEndMsg,
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
  isPromptReq,
  isToplevelBegin,
  isToplevelEnd,
  isToplevelLine,
  LineMsg,
  PromptReq,
  ToplevelBeginMsg,
  ToplevelEndMsg,
} from "@vibes.diy/call-ai-v2";
import { BrutalistCard } from "./vibes/BrutalistCard.js";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "react-router";

interface MessageListProps {
  promptBlocks: PromptBlock[];
  promptProcessing: boolean;
  chatId: string;
  // setSelectedResponseId: (id: string) => void;
  // selectedResponseId: string;
  // setMobilePreviewShown: (shown: boolean) => void;
  // navigateToView: (view: ViewType) => void;
}

function TopLevelMsg({ lines, begin }: { begin: ToplevelBeginMsg; lines: LineMsg[] }) {
  return (
    <div className="mb-4 flex flex-row justify-end px-4" key={begin.sectionId}>
      <BrutalistCard size="md" messageType="ai" className="max-w-[85%]">
        <div className="prose prose-sm dark:prose-invert prose-ul:pl-5 prose-ul:list-disc prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0 max-w-none">
          <ReactMarkdown>{lines.map((i) => i.line).join("\n")}</ReactMarkdown>
        </div>
      </BrutalistCard>
    </div>
  );
}

function Prompt({ msg }: { msg: PromptReq }) {
  return (
    <div className="mb-4 flex flex-row justify-end px-4" key={msg.streamId}>
      <BrutalistCard size="md" messageType="user" className="max-w-[85%]">
        <div className="prose prose-sm dark:prose-invert prose-ul:pl-5 prose-ul:list-disc prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0 max-w-none">
          <ReactMarkdown>
            {msg.request.messages
              .filter((i) => i.role === "user")
              .reduce((acc, i) => {
                acc.push(...i.content.filter((j) => j.type === "text").map((k) => k.text));
                return acc;
              }, [] as string[])
              .join("\n")}
          </ReactMarkdown>
        </div>
      </BrutalistCard>
    </div>
  );
}

function CodeMsg({ lines, begin, end }: { begin: CodeBeginMsg; lines: LineMsg[]; end?: CodeEndMsg }) {
  const [_, setSearchParam] = useSearchParams();

  const handleCodeClick = useCallback(() => {
    console.log(`handleCodeClick`, begin.sectionId);
    setSearchParam((prev) => {
      prev.set("sectionId", begin.sectionId);
      prev.set("view", "code");
      return prev;
    });
  }, []);
  // Calculate local codeReady state based on segments.length > 2 or !promptProcessing
  const codeReady = !!end;

  // const isSelected = messageId === selectedResponseId;

  return (
    <div className="mb-4 flex flex-row justify-start px-4" key={begin.sectionId}>
      {/* <div className="mr-2 flex-shrink-0">
        <div
          className="bg-light-decorative-02 dark:bg-dark-decorative-02 flex h-8 w-8 items-center justify-center rounded-full shadow-sm"
          title={begin.lang}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
            />
          </svg>
        </div>
      </div> */}
      <div className="max-w-[85%]">
        <BrutalistCard
          size="sm"
          data-code-segment={begin.blockId}
          style={{
            position: "sticky",
            top: "8px",
            zIndex: 10,
          }}
          className="sticky-active relative mx-3 my-4 cursor-pointer transition-all"
          onClick={handleCodeClick}
        >
          <div
            className={`absolute -top-1 left-1 text-lg ${
              !codeReady
                ? "text-orange-500 dark:text-orange-400"
                : // : isSelected
                  // ? "text-green-500 dark:text-green-400"
                  "text-accent-01 dark:text-accent-02"
            }`}
          >
            •
          </div>
          <div className="flex items-center justify-between rounded-sm p-2">
            <span className="text-accent-01 dark:text-accent-01 font-mono text-sm">
              {`${lines.length} line${lines.length !== 1 ? "s" : ""}`}
            </span>
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation(); // Prevent triggering the parent's onClick
                // If shift key is pressed, copy the raw message text instead of just the code
                // const textToCopy = e.shiftKey && rawText ? rawText : content;
                navigator.clipboard.writeText(lines.map((i) => i.line).join("\n"));
              }}
              className="bg-light-background-02 hover:accent-00 dark:bg-dark-background-01 dark:hover:bg-dark-decorative-00 text-accent-01 hover:text-accent-02 dark:text-accent-01 dark:hover:text-dark-secondary rounded-sm px-2 py-1 text-sm transition-colors active:bg-orange-400 active:text-orange-800 dark:active:bg-orange-600 dark:active:text-orange-200"
            >
              <code className="font-mono">
                <span className="mr-3">{begin.lang} App.jsx</span>

                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" className="inline-block">
                  <path
                    fill="currentColor"
                    d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"
                  ></path>
                  <path
                    fill="currentColor"
                    d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"
                  ></path>
                </svg>
              </code>
            </button>
          </div>

          {/* Code preview with height transition instead of conditional rendering */}
          <div
            className={`bg-light-background-02 dark:bg-dark-background-01 m-0 h-0 max-h-0 min-h-0 overflow-hidden rounded-sm border-0 p-0 font-mono text-sm opacity-0 shadow-inner transition-all`}
          >
            {lines.slice(0, 3).map((line) => (
              <div key={line.lineNr} className="text-light-primary dark:text-dark-secondary truncate">
                {line.line || " "}
              </div>
            ))}
            {lines.length > 3 && <div className="text-accent-01 dark:text-accent-01">...</div>}
          </div>
        </BrutalistCard>
      </div>
    </div>
  );
}

function fixCurrentStreaming(promptBlock: PromptBlock) {
  let lineNr = 0;
  for (const block of [...promptBlock.msgs].reverse()) {
    switch (true) {
      case isToplevelEnd(block):
      case isCodeEnd(block):
        return promptBlock;

      case isCodeLine(block):
      case isToplevelLine(block):
        lineNr++;
        break;

      case isToplevelBegin(block):
      case isCodeBegin(block):
        return {
          ...promptBlock,
          msgs: [
            ...promptBlock.msgs,
            {
              ...block,
              type: "block.toplevel.end",
              timestamp: new Date(),
              stats: {
                lines: lineNr,
                bytes: NaN,
              },
            } satisfies ToplevelEndMsg,
          ],
        };
    }
  }
  return promptBlock;
}

function MessageList({
  promptBlocks,
  chatId,
  // setSelectedResponseId,
  // selectedResponseId,
  // setMobilePreviewShown,
  // navigateToView,
}: MessageListProps) {
  // console.log(
  //   "MessageList",
  //   promptBlocks.length,
  //   promptBlocks.reduce((a, i) => a + i.msgs.length, 0)
  // );
  // Create a special message list when there's only one user message
  // const shouldShowWaitingIndicator = promptBlocks.find(i => isBlockBegin(i)) && promptBlocks.find(i => )

  // promptBlocks.length === 1 // && promptBlocks[0]?.type === "user";

  // Handle special case for waiting state
  const messageElements = promptBlocks.reduce((acc, promptBlock) => {
    // Only show the streaming indicator on the latest AI message
    // const isLatestAiMessage = promptProcessing && i === latestAiMessageIndex && msg.type === "ai";
    let collectedMsg: LineMsg[] = [];
    let codeBegin: CodeBeginMsg;
    let toplevelBegin: ToplevelBeginMsg;
    for (const msg of fixCurrentStreaming(promptBlock).msgs) {
      // console.log(">>>>>", msg)
      switch (true) {
        // case isPromptBlockBegin(msg):
        // case isPromptBlockEnd(msg):
        case isPromptReq(msg):
          acc.push(<Prompt key={msg.streamId} msg={msg} />);
          break;

        case isCodeBegin(msg):
          collectedMsg = [];
          codeBegin = msg;
          break;
        case isToplevelBegin(msg):
          collectedMsg = [];
          toplevelBegin = msg;
          break;
        case isToplevelLine(msg):
        case isCodeLine(msg):
          collectedMsg.push(msg);
          break;
        case isCodeEnd(msg):
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          acc.push(<CodeMsg key={codeBegin!.sectionId} begin={codeBegin!} lines={collectedMsg} />);
          collectedMsg = [];
          break;
        case isToplevelEnd(msg):
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          acc.push(<TopLevelMsg key={toplevelBegin!.sectionId} begin={toplevelBegin!} lines={collectedMsg} />);
          collectedMsg = [];
          break;
      }
    }
    return acc;
  }, [] as React.ReactElement[]);

  return (
    <div className="flex-1" key={chatId}>
      <div className="mx-auto flex min-h-full max-w-5xl flex-col py-4">
        <div className="flex flex-col space-y-4">{messageElements}</div>
      </div>
    </div>
  );
}
export default memo(MessageList, (prevProps, nextProps) => {
  // Reference equality check for promptProcessing flag
  const streamingStateEqual = prevProps.promptProcessing === nextProps.promptProcessing;

  const promptBlocks = nextProps.promptBlocks.length === prevProps.promptBlocks.length;

  const msgs =
    nextProps.promptBlocks.reduce((a, i) => a + i.msgs.length, 0) === prevProps.promptBlocks.reduce((a, i) => a + i.msgs.length, 0);

  // // Check if setSelectedResponseId changed
  // const setSelectedResponseIdEqual = prevProps.setSelectedResponseId === nextProps.setSelectedResponseId;

  // // Check if selectedResponseId changed
  // const selectedResponseIdEqual = prevProps.selectedResponseId === nextProps.selectedResponseId;

  // // Check if setMobilePreviewShown changed
  // const setMobilePreviewShownEqual = prevProps.setMobilePreviewShown === nextProps.setMobilePreviewShown;

  // Content equality check for messages - must compare text content
  // const messagesEqual =
  //   prevProps.messages.length === nextProps.messages.length &&
  //   prevProps.messages.every((msg, i) => {
  //     const nextMsg = nextProps.messages[i];
  //     // Check message ID and text content
  //     return msg._id === nextMsg._id && msg.text === nextMsg.text;
  //   });

  // Check if navigateToView changed
  // const navigateToViewEqual = prevProps.navigateToView === nextProps.navigateToView;

  if (!(streamingStateEqual && promptBlocks && msgs)) {
    console.log("MessageList needs update", prevProps, nextProps, streamingStateEqual, promptBlocks, msgs);
  }
  return (
    streamingStateEqual && promptBlocks && msgs

    // messagesEqual &&
    // setSelectedResponseIdEqual &&
    // selectedResponseIdEqual &&
    // setMobilePreviewShownEqual &&
    // navigateToViewEqual
  );
});
