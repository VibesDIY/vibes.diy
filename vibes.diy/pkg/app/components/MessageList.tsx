import React, { memo, useEffect, useRef } from "react";
// import type { ChatMessageDocument, ViewType } from "@vibes.diy/prompts";
import { PromptBlock } from "../routes/chat/chat.$ownerHandle.$appSlug.js";
import { parseOptionLines } from "../utils/option-lines.js";
import { OptionButtons } from "./OptionButtons.js";
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
  isCodeTruncated,
  isToplevelBegin,
  isToplevelEnd,
  isToplevelLine,
  LineMsg,
  ToplevelBeginMsg,
  ToplevelEndMsg,
} from "@vibes.diy/call-ai-v2";
import { BrutalistCard } from "@vibes.diy/base";
import ReactMarkdown from "react-markdown";
import { PromptError, PromptReq, isPromptError, isPromptReq } from "@vibes.diy/api-types";

interface MessageListProps {
  promptBlocks: PromptBlock[];
  promptProcessing: boolean;
  chatId: string;
  selectedFsId?: string;
  onClick: (fsRes: { ownerHandle: string; appSlug: string; fsId: string }) => void;
  onRetry?: (msg: PromptError) => void;
  onSelectOption?: (option: string) => void;
  // Block IDs whose save originated from the agent autosave (end-of-aider-
  // turn). Renders "Agent saved code" instead of "User edited code".
  agentSavedBlockIds?: ReadonlySet<string>;
  // setSelectedResponseId: (id: string) => void;
  // selectedResponseId: string;
  // setMobilePreviewShown: (shown: boolean) => void;
  // navigateToView: (view: ViewType) => void;
}

// Chat debug surface — three ways to inspect runtime evolution of the
// rendered chat without giving the frontend its own state machine:
//   1. data-* attributes on every bubble (chatId, promptId, sectionId,
//      blockId, blockSeq, message-role, render-seq) → readable via
//      Chrome MCP take_snapshot.
//   2. console.log("[chat-debug]", { component, renderSeq, ...ctx }) on
//      mount + every prop change → readable via Chrome MCP
//      list_console_messages.
//   3. window.__chatDebug ring buffer with the last 1000 events →
//      readable via Chrome MCP evaluate_script. Survives across
//      re-renders so you can dump after the fact.
// The frontend never *changes* state from this — it only reflects the
// backend events that flowed through. If something looks wrong here,
// the bug is in the backend or the wire.
interface ChatDebugEvent {
  readonly component: string;
  readonly renderSeq: number;
  readonly at: string;
  readonly [k: string]: unknown;
}
interface ChatDebugApi {
  readonly buffer: ChatDebugEvent[];
  readonly capacity: number;
  push(event: ChatDebugEvent): void;
  tail(n?: number): ChatDebugEvent[];
  filter(pred: (e: ChatDebugEvent) => boolean): ChatDebugEvent[];
  bySectionId(sectionId: string): ChatDebugEvent[];
  byPromptId(promptId: string): ChatDebugEvent[];
  clear(): void;
  dump(): ChatDebugEvent[];
}
function installChatDebug(): ChatDebugApi {
  const w = globalThis as unknown as { __chatDebug?: ChatDebugApi };
  if (w.__chatDebug) return w.__chatDebug;
  const capacity = 1000;
  const buffer: ChatDebugEvent[] = [];
  const api: ChatDebugApi = {
    buffer,
    capacity,
    push(event) {
      buffer.push(event);
      if (buffer.length > capacity) buffer.splice(0, buffer.length - capacity);
    },
    tail(n = 20) {
      return buffer.slice(-n);
    },
    filter(pred) {
      return buffer.filter(pred);
    },
    bySectionId(sectionId) {
      return buffer.filter((e) => e.sectionId === sectionId);
    },
    byPromptId(promptId) {
      return buffer.filter((e) => e.promptId === promptId);
    },
    clear() {
      buffer.splice(0, buffer.length);
    },
    dump() {
      return [...buffer];
    },
  };
  w.__chatDebug = api;
  return api;
}
const chatDebug = installChatDebug();

function useChatDebug(component: string, ctx: Record<string, unknown>): number {
  const renderSeq = useRef(0);
  renderSeq.current += 1;
  useEffect(() => {
    const event: ChatDebugEvent = {
      component,
      renderSeq: renderSeq.current,
      at: new Date().toISOString(),
      ...ctx,
    };
    chatDebug.push(event);
    // Console mirror disabled — events still buffered and accessible via
    // window.__chatDebug.dump(). Re-enable for low-level UI render tracing.
    // console.log("[chat-debug]", event);
    // ctx is a fresh object each render; deps below capture its values.
  }, [component, JSON.stringify(ctx)]);
  return renderSeq.current;
}

function TopLevelMsg({
  lines,
  begin,
  isLast,
  isFirstWithOptions,
  streaming,
  onSelectOption,
}: {
  begin: ToplevelBeginMsg;
  lines: LineMsg[];
  isLast: boolean;
  /**
   * True only for the first assistant message in the chat whose options are
   * non-empty. Forwarded to OptionButtons to render a one-line explainer
   * above the buttons. Set by MessageList's post-render epilogue (see the
   * "first-with-options" scan pass near the bottom of this file).
   */
  isFirstWithOptions?: boolean;
  /**
   * True when this message is the most recent assistant turn AND the chat is
   * currently streaming. Forwarded to parseOptionLines so the streaming guard
   * (which keeps mid-word marker lines in prose to prevent flicker) only
   * applies when the message is genuinely mid-stream. Default false.
   */
  streaming?: boolean;
  onSelectOption?: (option: string) => void;
}) {
  const fullText = lines.map((i) => i.line).join("\n");
  const { prose, options } = parseOptionLines(fullText, { streaming: streaming === true });

  const renderSeq = useChatDebug("TopLevelMsg", {
    sectionId: begin.sectionId,
    blockId: begin.blockId,
    streamId: begin.streamId,
    seq: begin.seq,
    blockNr: begin.blockNr,
    lineCount: lines.length,
    optionCount: options.length,
    isLast,
  });

  return (
    <div
      className="mb-4 flex flex-row justify-end px-4"
      key={begin.sectionId}
      data-message-role="narration"
      data-section-id={begin.sectionId}
      data-block-id={begin.blockId}
      data-prompt-id={begin.streamId}
      data-block-seq={begin.seq}
      data-render-seq={renderSeq}
    >
      <BrutalistCard size="md" messageType="ai" className="mr-8 max-w-[85%]" style={{ fontSize: "0.8rem" }}>
        <div className="prose prose-sm dark:prose-invert prose-ul:pl-5 prose-ul:list-disc prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0 max-w-none [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
          <ReactMarkdown>{prose}</ReactMarkdown>
        </div>
        <OptionButtons
          options={options}
          disabled={!isLast}
          isFirst={isFirstWithOptions}
          onSelect={isLast ? onSelectOption : undefined}
        />
      </BrutalistCard>
    </div>
  );
}

function Prompt({ msg }: { msg: PromptReq }) {
  const renderSeq = useChatDebug("Prompt", { streamId: msg.streamId });
  return (
    <div
      className="mb-4 flex flex-row justify-end px-4"
      key={msg.streamId}
      data-message-role="user-prompt"
      data-prompt-id={msg.streamId}
      data-render-seq={renderSeq}
    >
      <BrutalistCard size="md" messageType="user" className="max-w-[85%]" style={{ fontSize: "0.8rem" }}>
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

function PromptErrorMsg({ msg, onRetry }: { msg: PromptError; onRetry?: (msg: PromptError) => void }) {
  const renderSeq = useChatDebug("PromptErrorMsg", { streamId: msg.streamId, error: msg.error });
  return (
    <div
      className="mb-4 flex flex-row justify-end px-4"
      key={msg.streamId}
      data-message-role="prompt-error"
      data-prompt-id={msg.streamId}
      data-render-seq={renderSeq}
    >
      <BrutalistCard size="md" messageType="user" className="max-w-[85%]" style={{ fontSize: "0.8rem" }}>
        <div className="prose prose-sm dark:prose-invert prose-ul:pl-5 prose-ul:list-disc prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0 max-w-none">
          {`Error: ${msg.error}`}
        </div>
        {onRetry && (
          <button
            onClick={() => onRetry(msg)}
            className="mt-2 rounded-sm px-3 py-1 text-sm font-medium text-orange-600 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/30"
          >
            Retry
          </button>
        )}
      </BrutalistCard>
    </div>
  );
}

function CodeMsg({
  lines,
  begin,
  end,
  truncated,
  onClick,
}: {
  begin: CodeBeginMsg;
  lines: LineMsg[];
  end?: CodeEndMsg;
  truncated?: { reason: string; kind: string; truncatedAtLine: number };
  onClick: () => void;
}) {
  const codeReady = end !== undefined;
  const isTruncated = truncated !== undefined;
  const renderSeq = useChatDebug("CodeMsg", {
    sectionId: begin.sectionId,
    blockId: begin.blockId,
    streamId: begin.streamId,
    seq: begin.seq,
    blockNr: begin.blockNr,
    lang: begin.lang,
    path: begin.path,
    lineCount: lines.length,
    codeReady,
    truncated: isTruncated,
    truncatedReason: truncated?.reason,
  });

  // Dot color: green when ready, yellow when truncated (recovery in
  // progress), orange when streaming. The truncated card stays in the
  // chat as honest history; reload normalizes since the failed block
  // was never persisted.
  const dotClass = isTruncated
    ? "text-yellow-500 dark:text-yellow-400"
    : codeReady
      ? "text-accent-01 dark:text-accent-02"
      : "text-orange-500 dark:text-orange-400";
  const dotGlyph = isTruncated ? "↻" : "•";

  return (
    <div
      className="mb-4 flex flex-row justify-start px-4"
      key={begin.sectionId}
      data-message-role="code"
      data-section-id={begin.sectionId}
      data-block-id={begin.blockId}
      data-prompt-id={begin.streamId}
      data-block-seq={begin.seq}
      data-block-nr={begin.blockNr}
      data-code-ready={codeReady ? "true" : "false"}
      data-truncated={isTruncated ? "true" : "false"}
      data-truncated-reason={truncated?.reason}
      data-line-count={lines.length}
      data-render-seq={renderSeq}
    >
      <div className="max-w-[85%]">
        <BrutalistCard
          size="sm"
          data-code-segment={begin.blockId}
          style={{
            position: "sticky",
            top: "8px",
            zIndex: 10,
            borderRadius: 0,
            border: "1px solid var(--vibes-card-border)",
          }}
          className="sticky-active relative mx-3 my-4 cursor-pointer transition-all"
          onClick={onClick}
        >
          <div className={`absolute -top-1 left-1 text-lg ${dotClass}`}>{dotGlyph}</div>
          <div className="flex items-center justify-between rounded-sm p-2">
            <span className="text-accent-01 dark:text-accent-01 font-mono text-sm">
              {`${lines.length} line${lines.length !== 1 ? "s" : ""}`}
              {isTruncated ? (
                <span className="ml-2 text-yellow-600 dark:text-yellow-400 italic">{`↻ recovering · ${truncated.reason}`}</span>
              ) : null}
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
            {lines.slice(0, 3).map((line, idx) => (
              <div key={`${begin.blockId}-${line.lineNr}-${idx}`} className="text-light-primary dark:text-dark-secondary truncate">
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
  // Either end or truncated will be present; never both. A truncated
  // block means the server suppressed the failed code.end and emitted
  // block.code.truncated in its place — the closure event is the
  // truncate, not an end.
  end?: CodeEndMsg;
  truncated?: { reason: string; kind: string; truncatedAtLine: number };
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
  promptProcessing,
  chatId,
  selectedFsId,
  onClick,
  onRetry,
  onSelectOption,
  agentSavedBlockIds,
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
  let lastFsRef: { fsId: string; appSlug: string; ownerHandle: string } | undefined;

  const messageElements = promptBlocks.reduce((acc, promptBlock) => {
    // Only show the streaming indicator on the latest AI message
    // const isLatestAiMessage = promptProcessing && i === latestAiMessageIndex && msg.type === "ai";
    let collectedMsg: LineMsg[] = [];
    let codeBegin: CodeBeginMsg;
    let toplevelBegin: ToplevelBeginMsg;
    let hasPromptReq = false;
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
          acc.push(<PromptErrorMsg key={`error-${msg.streamId}`} msg={msg} onRetry={onRetry} />);
          break;
        case isPromptReq(msg):
          hasPromptReq = true;
          acc.push(<Prompt key={`prompt-${msg.streamId}`} msg={msg} />);
          break;

        case isBlockBegin(msg):
          blockMsgs.splice(0, blockMsgs.length);
          break;
        case isBlockEnd(msg):
          if (!hasPromptReq && blockMsgs.some((b) => b.type === "Code")) {
            const isAgentSaved = agentSavedBlockIds?.has(msg.blockId) ?? false;
            const label = isAgentSaved ? "Agent saved code" : "User edited code";
            acc.push(
              <div
                key={`edited-${msg.blockId}`}
                className="mx-4 text-sm italic text-gray-400 dark:text-gray-500"
                data-message-role={isAgentSaved ? "agent-saved" : "user-edited"}
                data-block-id={msg.blockId}
                data-prompt-id={msg.streamId}
                data-block-seq={msg.seq}
              >
                {label}
              </div>
            );
          }
          blockMsgs.forEach((block, idx) => {
            // console.log(">>>>>", block.type, block.begin.sectionId, block.lines.length)
            if (block.type === "Code") {
              // console.log(`code rendered`, block.begin.sectionId, block.lines)
              if (msg.fsRef) {
                lastFsRef = { fsId: msg.fsRef.fsId, appSlug: msg.fsRef.appSlug, ownerHandle: msg.fsRef.ownerHandle };
              }
              acc.push(
                <CodeMsg
                  key={`code-${block.begin.sectionId}-${idx}`}
                  begin={block.begin}
                  lines={block.lines}
                  end={block.end}
                  truncated={block.truncated}
                  onClick={() => {
                    if (msg.fsRef) {
                      onClick({
                        fsId: msg.fsRef.fsId,
                        appSlug: msg.fsRef.appSlug,
                        ownerHandle: msg.fsRef.ownerHandle,
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
              acc.push(
                <TopLevelMsg
                  key={`toplevel-${block.begin.sectionId}-${idx}`}
                  begin={block.begin}
                  lines={block.lines}
                  isLast={false}
                  onSelectOption={onSelectOption}
                />
              );
            }
          });
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
        case isCodeTruncated(msg):
          // The recovery's block.begin clears blockMsgs before the original
          // stream's block.end can fire, so anything we want to keep visible
          // from the failed turn must be drained to acc here. Drain order:
          //   1. Any preceding clean blocks (Code or TopLevel) the model
          //      wrote before the failure — flush blockMsgs.
          //   2. The truncated block itself, rendered as a ↻ recovering card.
          // After this, the recovery's block.begin will clear an empty
          // blockMsgs and proceed normally.
          blockMsgs.forEach((preBlock, preIdx) => {
            if (preBlock.type === "Code") {
              acc.push(
                <CodeMsg
                  key={`pre-truncate-code-${preBlock.begin.sectionId}-${preIdx}`}
                  begin={preBlock.begin}
                  lines={preBlock.lines}
                  end={preBlock.end}
                  truncated={preBlock.truncated}
                  onClick={() => {
                    /* no fsRef yet — the original block.end never fired */
                  }}
                />
              );
            } else {
              acc.push(
                <TopLevelMsg
                  key={`pre-truncate-top-${preBlock.begin.sectionId}-${preIdx}`}
                  begin={preBlock.begin}
                  lines={preBlock.lines}
                  isLast={false}
                  onSelectOption={undefined}
                />
              );
            }
          });
          blockMsgs.splice(0, blockMsgs.length);

          // Render the truncated block. Push to acc so the recovery's later
          // block.begin doesn't erase it. The truncated card has no fsRef
          // and onClick is a no-op (no navigable target).
          acc.push(
            <CodeMsg
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              key={`truncated-${codeBegin!.sectionId}`}
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              begin={codeBegin!}
              lines={collectedMsg}
              truncated={{ reason: msg.reason, kind: msg.kind, truncatedAtLine: msg.truncatedAtLine }}
              onClick={() => {
                /* no-op: truncated blocks have no navigable target */
              }}
            />
          );
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

  // Mark the most recent TopLevelMsg's state. When the chat is settled,
  // it gets isLast + onSelectOption so its buttons become interactive. When
  // streaming, it gets streaming: true so parseOptionLines defers mid-word
  // markers (flicker prevention).
  for (let i = messageElements.length - 1; i >= 0; i--) {
    const el = messageElements[i];
    if (React.isValidElement(el) && el.type === TopLevelMsg) {
      if (promptProcessing) {
        messageElements[i] = React.cloneElement(el as React.ReactElement<{ streaming?: boolean }>, { streaming: true });
      } else {
        messageElements[i] = React.cloneElement(
          el as React.ReactElement<{ isLast: boolean; onSelectOption?: (o: string) => void }>,
          { isLast: true, onSelectOption }
        );
      }
      break;
    }
  }

  // Mark the FIRST TopLevelMsg with options as the chat's introductory
  // interview turn — its OptionButtons render a one-line explainer above
  // the buttons telling the user the options are optional. Only the first
  // such message in chat order gets the helper; subsequent options-turns
  // omit it (the user only needs to learn the affordance once).
  for (let i = 0; i < messageElements.length; i++) {
    const el = messageElements[i];
    if (!React.isValidElement(el) || el.type !== TopLevelMsg) continue;
    const elProps = el.props as { lines: LineMsg[] };
    const fullText = elProps.lines.map((l) => l.line).join("\n");
    const { options } = parseOptionLines(fullText);
    if (options.length === 0) continue;
    messageElements[i] = React.cloneElement(
      el as React.ReactElement<{ isLast: boolean; isFirstWithOptions?: boolean; onSelectOption?: (o: string) => void }>,
      {
        isFirstWithOptions: true,
      }
    );
    break;
  }

  useEffect(() => {
    if (lastFsRef && !selectedFsId) {
      onClick(lastFsRef);
    }
  }, [lastFsRef?.fsId]);

  // console.log("Render-React-C", messageElements.length)

  return (
    <div className="flex-1" key={chatId} data-chat-id={chatId} data-chat-message-count={messageElements.length}>
      <div className="mx-auto flex min-h-full max-w-5xl flex-col py-4">
        <div className="flex flex-col space-y-4">{messageElements}</div>
      </div>
    </div>
  );
}

export default memo(MessageList, (prevProps, nextProps) => {
  // console.log(`promptState:`, promptState.blocks.length, promptState.blocks.map(i => i.msgs.length))
  const streamingStateEqual = prevProps.promptProcessing === nextProps.promptProcessing;

  const promptBlocks = nextProps.promptBlocks.length === prevProps.promptBlocks.length;

  const msgs =
    nextProps.promptBlocks.reduce((a, i) => a + i.msgs.length, 0) === prevProps.promptBlocks.reduce((a, i) => a + i.msgs.length, 0);

  return streamingStateEqual && promptBlocks && msgs;
});
