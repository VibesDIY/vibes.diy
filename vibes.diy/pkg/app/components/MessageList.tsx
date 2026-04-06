import React, { memo, useEffect } from "react";
// import type { ChatMessageDocument, ViewType } from "@vibes.diy/prompts";
import { PromptBlock } from "../routes/chat/chat.$userSlug.$appSlug.js";
import {
  BlockBeginMsg,
  BlockEndMsg,
  CodeBeginMsg,
  CodeEndMsg,
  isBlockBegin,
  isBlockEnd,
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
  isPromptError,
  isPromptReq,
  isToplevelBegin,
  isToplevelEnd,
  isToplevelLine,
  LineMsg,
  PromptError,
  PromptReq,
  ToplevelBeginMsg,
  ToplevelEndMsg,
} from "@vibes.diy/call-ai-v2";
import ReactMarkdown from "react-markdown";

interface MessageListProps {
  promptBlocks: PromptBlock[];
  promptProcessing: boolean;
  chatId: string;
  selectedFsId?: string;
  onClick: (fsRes: { userSlug: string; appSlug: string; fsId: string }) => void;
  onRetry?: (msg: PromptError) => void;
  // setSelectedResponseId: (id: string) => void;
  // selectedResponseId: string;
  // setMobilePreviewShown: (shown: boolean) => void;
  // navigateToView: (view: ViewType) => void;
}

function TopLevelMsg({ lines, begin }: { begin: ToplevelBeginMsg; lines: LineMsg[] }) {
  return (
    <div className="flex" key={begin.sectionId}>
      <div className="vibes-chat-bubble vibes-chat-bubble-assistant">
        <div className="prose prose-sm dark:prose-invert prose-ul:pl-5 prose-ul:list-disc prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0 max-w-none">
          <ReactMarkdown>{lines.map((i) => i.line).join("\n")}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function Prompt({ msg }: { msg: PromptReq }) {
  return (
    <div className="flex justify-end" key={msg.streamId}>
      <div className="vibes-chat-bubble vibes-chat-bubble-user">
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
      </div>
    </div>
  );
}

function PromptErrorMsg({ msg, onRetry }: { msg: PromptError; onRetry?: (msg: PromptError) => void }) {
  return (
    <div className="flex justify-center" key={msg.streamId}>
      <div className="vibes-chat-bubble vibes-chat-bubble-error">
        {`Error: ${msg.error}`}
        {onRetry && (
          <button
            onClick={() => onRetry(msg)}
            className="vibes-chat-retry-btn"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function CodeMsg({ lines, begin, end, onClick }: { begin: CodeBeginMsg; lines: LineMsg[]; end?: CodeEndMsg; onClick: () => void }) {
  // const [searchParams, setSearchParam] = useSearchParams();

  // const handleCodeClick = useCallback(() => {
  //   setSearchParam((prev) => {
  //     prev.set("sectionId", begin.sectionId);
  //     if (!prev.has("view")) {
  //       prev.set("view", "code");
  //     }
  //     return prev;
  //   });
  // }, [searchParams, begin.sectionId, setSearchParam]);

  const codeReady = !!end;

  return (
    <div className="flex" key={begin.sectionId}>
      <div
        className="vibes-chat-bubble vibes-chat-bubble-assistant cursor-pointer"
        data-code-segment={begin.blockId}
        onClick={onClick}
        style={{ position: "sticky", top: "8px", zIndex: 10 }}
      >
        <div
          className={`absolute -top-1 left-1 text-lg ${
            !codeReady ? "text-orange-500" : "text-[var(--vibes-blue)]"
          }`}
          style={{ position: "absolute", top: -4, left: 4 }}
        >
          •
        </div>
        <div className="flex items-center justify-between p-1">
          <span className="font-mono text-sm" style={{ color: "var(--vibes-near-black)" }}>
            {`${lines.length} line${lines.length !== 1 ? "s" : ""}`}
          </span>
          <button
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              navigator.clipboard.writeText(lines.map((i) => i.line).join("\n"));
            }}
            className="rounded px-2 py-1 text-sm transition-colors"
            style={{ background: "rgba(0,0,0,0.06)", color: "var(--vibes-near-black)" }}
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
      </div>
    </div>
  );
}

function fixCurrentStreaming(promptBlock: PromptBlock): PromptBlock {
  const topLevelStat = { lines: 0, bytes: 0 };
  const codeLevelStat = { lines: 0, bytes: 0 };
  let inBlock: BlockBeginMsg | undefined = undefined;
  let inTopLevel: ToplevelBeginMsg | undefined = undefined;
  let inCodeBlock: CodeBeginMsg | undefined = undefined;
  for (const block of promptBlock.msgs) {
    switch (true) {
      case isBlockBegin(block):
        inBlock = block;
        break;
      case isBlockEnd(block):
        inBlock = undefined;
        break;

      case isToplevelBegin(block):
        inTopLevel = block;
        break;
      case isToplevelEnd(block):
        inTopLevel = undefined;
        break;
      case isCodeBegin(block):
        inCodeBlock = block;
        break;

      case isCodeEnd(block):
        inCodeBlock = undefined;
        break;

      case isCodeLine(block):
        codeLevelStat.bytes = block.line.length;
        codeLevelStat.lines++;
        break;
      case isToplevelLine(block):
        topLevelStat.bytes = block.line.length;
        topLevelStat.lines++;
        break;
    }
  }
  // if (!!inTopLevel || !!inCodeBlock && !!inBlock) {
  //   console.log(`fixCurrentStreaming-open-blocks`, !!inTopLevel, !!inCodeBlock, !!inBlock)
  // }
  const closeUnclosed: (BlockEndMsg | ToplevelEndMsg | CodeEndMsg)[] = [];
  if (inTopLevel) {
    closeUnclosed.push({
      ...inTopLevel,
      type: "block.toplevel.end",
      timestamp: new Date(),
      stats: topLevelStat,
    } satisfies ToplevelEndMsg);
  }
  if (inCodeBlock) {
    closeUnclosed.push({
      ...inCodeBlock,
      type: "block.code.end",
      timestamp: new Date(),
      stats: codeLevelStat,
    } satisfies CodeEndMsg);
  }
  if (inBlock) {
    closeUnclosed.push({
      ...inBlock,
      type: "block.end",
      stats: {
        toplevel: topLevelStat,
        code: codeLevelStat,
        image: {
          lines: 0,
          bytes: 0,
        },
        total: {
          lines: codeLevelStat.lines + topLevelStat.lines,
          bytes: codeLevelStat.bytes + topLevelStat.bytes,
        },
      },
      usage: {
        given: [],
        calculated: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      },
    } satisfies BlockEndMsg);
  }
  return {
    ...promptBlock,
    msgs: [...promptBlock.msgs, ...closeUnclosed],
  };
}

interface CodeBlock {
  type: "Code";
  begin: CodeBeginMsg;
  lines: LineMsg[];
  end: CodeEndMsg;
}
interface TopLevelBlock {
  type: "TopLevel";
  begin: ToplevelBeginMsg;
  lines: LineMsg[];
  end: ToplevelEndMsg;
}

type BlockedMsg = CodeBlock | TopLevelBlock;

function MessageList({
  promptBlocks,
  chatId,
  selectedFsId,
  onClick,
  onRetry,
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
  const blockMsgs: BlockedMsg[] = [];
  let lastFsRef: { fsId: string; appSlug: string; userSlug: string } | undefined;

  const messageElements = promptBlocks.reduce((acc, promptBlock) => {
    // Only show the streaming indicator on the latest AI message
    // const isLatestAiMessage = promptProcessing && i === latestAiMessageIndex && msg.type === "ai";
    let collectedMsg: LineMsg[] = [];
    let codeBegin: CodeBeginMsg;
    let toplevelBegin: ToplevelBeginMsg;
    // let traceBlockId: BlockEndMsg | undefined
    const nprompt = fixCurrentStreaming(promptBlock);
    // if (promptBlock.msgs.length !== nprompt.msgs.length) {
    //   const last = nprompt.msgs[nprompt.msgs.length -1]
    //   if (isBlockEnd(last)) {
    //     traceBlockId = last
    //   }
    //   console.log(`nprompt`, promptBlock.msgs.length, nprompt.msgs.length,
    //     nprompt.msgs.slice(promptBlock.msgs.length),
    //     traceBlockId?.blockId
    //   )
    // }
    // console.log(`inreduce`, blockMsgs.length, promptBlock.msgs.length, nprompt.msgs.length)
    for (const msg of nprompt.msgs) {
      // if (isBlockSteamMsg(msg) && traceBlockId?.blockId === msg.blockId) {
      //   console.log(`nprompt---`, msg)
      // }
      switch (true) {
        // case isPromptBlockBegin(msg):
        // case isPromptBlockEnd(msg):
        case isPromptError(msg):
          acc.push(<PromptErrorMsg key={msg.streamId} msg={msg} onRetry={onRetry} />);
          break;
        case isPromptReq(msg):
          acc.push(<Prompt key={msg.streamId} msg={msg} />);
          break;

        case isBlockBegin(msg):
          blockMsgs.splice(0, blockMsgs.length);
          break;
        case isBlockEnd(msg):
          // console.log(`Completed a Chat --- need to register the clicks`, msg);
          for (const block of blockMsgs) {
            // console.log(">>>>>", block.type, block.begin.sectionId, block.lines.length)
            if (block.type === "Code") {
              // console.log(`code rendered`, block.begin.sectionId, block.lines)
              if (msg.fsRef) {
                lastFsRef = { fsId: msg.fsRef.fsId, appSlug: msg.fsRef.appSlug, userSlug: msg.fsRef.userSlug };
              }
              acc.push(
                <CodeMsg
                  key={block.begin.sectionId}
                  begin={block.begin}
                  lines={block.lines}
                  end={block.end}
                  onClick={() => {
                    if (msg.fsRef) {
                      onClick({
                        fsId: msg.fsRef.fsId,
                        appSlug: msg.fsRef.appSlug,
                        userSlug: msg.fsRef.userSlug,
                      });
                    }
                  }}
                />
              );
            }
            if (block.type === "TopLevel") {
              // console.log(`top rendered`, block.begin.sectionId, block.lines)
              // if (isNaN(msg.stats.code.bytes)) {
              // console.log(`toplevel rendered`, block.lines)
              // }
              acc.push(<TopLevelMsg key={block.begin.sectionId} begin={block.begin} lines={block.lines} />);
            }
          }
          // blockMsgs.splice(0, blockMsgs.length);
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
          // acc.push(<CodeMsg key={codeBegin!.sectionId} begin={codeBegin!} lines={collectedMsg} />);
          break;
        case isCodeEnd(msg):
          blockMsgs.push({
            type: "Code",
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            begin: codeBegin!,
            lines: collectedMsg,
            end: msg,
          });
          collectedMsg = [];
          break;
        case isToplevelEnd(msg):
          blockMsgs.push({
            type: "TopLevel",
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            begin: toplevelBegin!,
            lines: collectedMsg,
            end: msg,
          });
          collectedMsg = [];
          break;
      }
    }
    return acc;
  }, [] as React.ReactElement[]);
  useEffect(() => {
    if (lastFsRef && !selectedFsId) {
      onClick(lastFsRef);
    }
  }, [lastFsRef?.fsId]);

  // console.log("Render-React-C", messageElements.length)

  return (
    <div className="vibes-chat-messages" key={chatId}>
      {messageElements}
    </div>
  );
}

export default memo(MessageList, (prevProps, nextProps) => {
  // console.log(`promptState:`, promptState.blocks.length, promptState.blocks.map(i => i.msgs.length))

  // Reference equality check for promptProcessing flag
  const streamingStateEqual = prevProps.promptProcessing === nextProps.promptProcessing;

  const promptBlocks = nextProps.promptBlocks.length === prevProps.promptBlocks.length;

  const msgs =
    nextProps.promptBlocks.reduce((a, i) => a + i.msgs.length, 0) === prevProps.promptBlocks.reduce((a, i) => a + i.msgs.length, 0);

  // console.log(">>>>>>>>",
  //   nextProps.promptBlocks.reduce((a, i) => a + i.msgs.length, 0),
  //   prevProps.promptBlocks.reduce((a, i) => a + i.msgs.length, 0)
  // )

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

  // if (!(streamingStateEqual && promptBlocks && msgs)) {
  //   console.log("MessageList needs update", prevProps, nextProps, streamingStateEqual, promptBlocks, msgs);
  // }
  // console.log(`promptState:`, msgs,
  //     prevProps.promptBlocks.length, prevProps.promptBlocks.map(i => i.msgs.length),
  //     nextProps.promptBlocks.length, nextProps.promptBlocks.map(i => i.msgs.length)
  //   )
  return (
    streamingStateEqual && promptBlocks && msgs

    // messagesEqual &&
    // setSelectedResponseIdEqual &&
    // selectedResponseIdEqual &&
    // setMobilePreviewShownEqual &&
    // navigateToViewEqual
  );
});
