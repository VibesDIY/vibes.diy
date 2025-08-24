import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  type AiChatMessageDocument,
  type UserChatMessageDocument,
  type VibeDocument,
  type ChatMessageDocument,
  normalizeModelId,
  UserSettings,
  resolveEffectiveModel,
  getLlmCatalogNames,
  getLlmCatalog,
} from "@vibes.diy/prompts";
import { getSessionDatabaseName } from "../utils/databaseManager.js";
import { Database, DocResponse, DocWithId, toCloud, useFireproof } from "use-fireproof";
import { encodeTitle } from "../components/SessionSidebar/utils.js";
import { VibesDiyEnv } from "../config/env.js";
import { generateCid } from "../utils/cidUtils.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useUserSettings } from "./useUserSettings.js";

interface SessionView {
  _id: string;
  title: string;
  publishedUrl?: string;
  firehoseShared?: boolean;
}

export interface UseSession {
  // // Session information
  session: SessionView;
  docs: ChatMessageDocument[];

  // // Databases
  sessionDatabase: Database;
  // openSessionDatabase: () => void;

  // // Session management functions
  updateTitle: (title: string) => Promise<void>;
  updatePublishedUrl: (publishedUrl: string) => Promise<void>;
  updateFirehoseShared: (firehoseShared: boolean) => Promise<void>;
  addScreenshot: (screenshotData: string | null) => Promise<void>;
  // // Message management
  userMessage: UserChatMessageDocument;
  submitUserMessage: () => Promise<void>;
  mergeUserMessage: (newDoc: Partial<UserChatMessageDocument>) => void;
  // saveUserMessage: (newDoc: UserChatMessageDocument) => Promise<void>;
  aiMessage: AiChatMessageDocument;
  selectedModel?: string;
  effectiveModel: string[];
  submitAiMessage: (e?: Event) => Promise<void>;
  mergeAiMessage: (newDoc: Partial<AiChatMessageDocument>) => void;
  updateDependencies: (deps: string[], userOverride?: boolean) => Promise<void>;
  updateInstructionalTextOverride: (
    override?: boolean | undefined,
  ) => Promise<void>;
  updateDemoDataOverride: (override?: boolean | undefined) => Promise<void>;
  updateAiSelectedDependencies: (
    aiSelectedDependencies: string[],
  ) => Promise<void>;
  updateSelectedModel: (modelId: string) => Promise<void>;
  saveAiMessage: (
    existingDoc?: DocWithId<AiChatMessageDocument> | undefined,
  ) => Promise<DocResponse>;
  // // Vibe document management
  vibeDoc: VibeDocument;
}

export function useSession(sessionId: string): UseSession {
  if (!sessionId) {
    throw new Error("useSession requires a valid sessionId");
  }
  const sessionDbName = getSessionDatabaseName(sessionId);
  const { isAuthenticated } = useAuth();
  const { isEnableSyncEnabled } = useUserSettings();
  const location = useLocation();

  // Only attach toCloud() when we're actually on a chat route (not just home page with session)
  const isOnChatRoute = location?.pathname?.startsWith("/chat/") || false;

  const {
    database: sessionDatabase,
    useDocument: useSessionDocument,
    useLiveQuery: useSessionLiveQuery,
  } = useFireproof(
    sessionDbName,
    isEnableSyncEnabled && isAuthenticated && sessionId && isOnChatRoute
      ? { attach: toCloud() }
      : {},
  );

  // User message is stored in the session-specific database
  const {
    doc: userMessage,
    merge: mergeUserMessage,
    submit: submitUserMessage,
  } = useSessionDocument<UserChatMessageDocument>({
    type: "user",
    session_id: sessionId,
    text: "",
    created_at: Date.now(),
  });

  // AI message is stored in the session-specific database
  const {
    doc: aiMessage,
    merge: mergeAiMessage,
    save: saveAiMessage,
    submit: submitAiMessage,
  } = useSessionDocument<AiChatMessageDocument>({
    type: "ai",
    session_id: sessionId,
    text: "",
    created_at: Date.now(),
  });

  // Vibe document is stored in the session-specific database
  const { doc: vibeDoc, merge: mergeVibeDoc } =
    useSessionDocument<VibeDocument>({
      _id: "vibe",
      title: "",
      encodedTitle: "",
      created_at: Date.now(),
      remixOf: "",
    });

  // Query messages from the session-specific database
  const { docs } = useSessionLiveQuery("session_id", { key: sessionId }) as {
    docs: ChatMessageDocument[];
  };

  // Stabilize merge function and vibe document with refs to avoid recreating callbacks
  const mergeRef = useRef(mergeVibeDoc);
  useEffect(() => {
    mergeRef.current = mergeVibeDoc;
  }, [mergeVibeDoc]);

  const vibeRef = useRef(vibeDoc);
  useEffect(() => {
    vibeRef.current = vibeDoc;
  }, [vibeDoc]);

  // Update session title using the vibe document
  const updateTitle = useCallback(
    async (title: string, isManual = false) => {
      const base = vibeRef.current;
      const encodedTitle = encodeTitle(title);
      const updatedDoc = {
        ...base,
        title,
        encodedTitle,
        titleSetManually: isManual,
      } as VibeDocument;

      // Merge first for immediate UI update, then persist
      mergeRef.current(updatedDoc);
      await sessionDatabase.put(updatedDoc);
    },
    [sessionDatabase],
  );

  // Update published URL using the vibe document
  const updatePublishedUrl = useCallback(
    async (publishedUrl: string) => {
      const base = vibeRef.current;
      const updatedDoc = { ...base, publishedUrl } as VibeDocument;
      mergeRef.current(updatedDoc);
      await sessionDatabase.put(updatedDoc);
    },
    [sessionDatabase],
  );

  // Update firehose shared state using the vibe document
  const updateFirehoseShared = useCallback(
    async (firehoseShared: boolean) => {
      const base = vibeRef.current;
      const updatedDoc = { ...base, firehoseShared } as VibeDocument;
      mergeRef.current(updatedDoc);
      await sessionDatabase.put(updatedDoc);
    },
    [sessionDatabase],
  );

  // Update per‑vibe dependency selection using the vibe document
  const updateDependencies = useCallback(
    async (deps: string[], userOverride = true) => {
      const input = Array.isArray(deps)
        ? deps.filter((n): n is string => typeof n === "string")
        : [];
      // Validate and de‑dupe by catalog names
      const catalogNames = await getLlmCatalogNames(
        VibesDiyEnv.PROMPT_FALL_BACKURL(),
      );
      const deduped = Array.from(
        new Set(input.filter((n) => catalogNames.has(n))),
      );
      const llmsCatalog = await getLlmCatalog(
        VibesDiyEnv.PROMPT_FALL_BACKURL(),
      );
      // Canonicalize order by catalog order
      const order = new Map(llmsCatalog.map((l, i) => [l.name, i] as const));
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const validDeps = deduped.sort((a, b) => order.get(a)! - order.get(b)!);

      const base = vibeRef.current;
      const updatedDoc = {
        ...base,
        dependencies: validDeps,
        dependenciesUserOverride: !!userOverride,
      } as VibeDocument;
      mergeRef.current(updatedDoc);
      await sessionDatabase.put(updatedDoc);
    },
    [sessionDatabase],
  );

  // Update per‑vibe instructional text override setting
  const updateInstructionalTextOverride = useCallback(
    async (override?: boolean) => {
      const base = vibeRef.current;
      const updatedDoc = {
        ...base,
        instructionalTextOverride: override,
      } as VibeDocument;
      mergeRef.current(updatedDoc);
      await sessionDatabase.put(updatedDoc);
    },
    [sessionDatabase],
  );

  // Update per‑vibe demo data override setting
  const updateDemoDataOverride = useCallback(
    async (override?: boolean) => {
      const base = vibeRef.current;
      const updatedDoc = {
        ...base,
        demoDataOverride: override,
      } as VibeDocument;
      mergeRef.current(updatedDoc);
      await sessionDatabase.put(updatedDoc);
    },
    [sessionDatabase],
  );

  // Update AI-selected dependencies (internal use for displaying in UI)
  const updateAiSelectedDependencies = useCallback(
    async (aiSelectedDependencies: string[]) => {
      const base = vibeRef.current;
      const updatedDoc = {
        ...base,
        aiSelectedDependencies,
      } as VibeDocument;
      mergeRef.current(updatedDoc);
      await sessionDatabase.put(updatedDoc);
    },
    [sessionDatabase],
  );
  // --- Model selection management ---
  const updateSelectedModel = useCallback(
    async (modelId: string) => {
      // Accept relaxed policy: any non-empty string; persist normalized (trimmed)
      const normalized = normalizeModelId(modelId);
      if (!normalized) return; // no-op on empty/whitespace
      const base = vibeRef.current;
      const updatedDoc = {
        ...base,
        selectedModel: normalized,
      } as VibeDocument;
      mergeRef.current(updatedDoc);
      await sessionDatabase.put(updatedDoc);
    },
    [sessionDatabase],
  );

  // Access global settings to compute effective model fallback
  const { useDocument: useSettingsDocument } = useFireproof(
    VibesDiyEnv.SETTINGS_DBNAME(),
  );
  const { doc: settingsDoc } = useSettingsDocument<UserSettings>({
    _id: "user_settings",
  });

  const [effectiveModel, setEffectiveModel] = useState<string[]>([]);
  useEffect(() => {
    resolveEffectiveModel(settingsDoc, vibeDoc).then((i) => {
      setEffectiveModel([i]);
    });
  }, [settingsDoc?.model, vibeDoc?.selectedModel]);

  // Add a screenshot to the session (in session-specific database)
  const addScreenshot = useCallback(
    async (screenshotData: string | null) => {
      if (!sessionId || !screenshotData) return;

      try {
        // Generate CID for the screenshot
        const cid = await generateCid(screenshotData);

        const response = await fetch(screenshotData);
        const blob = await response.blob();
        const file = new File([blob], "screenshot.png", {
          type: "image/png",
          lastModified: Date.now(),
        });
        const screenshot = {
          type: "screenshot",
          session_id: sessionId,
          cid, // Store CID for deduplication
          _files: {
            screenshot: file,
          },
        };
        await sessionDatabase.put(screenshot);
      } catch (error) {
        console.error("Failed to process screenshot:", error);
      }
    },
    [sessionId, sessionDatabase],
  );

  // Wrap submitUserMessage to ensure database is opened before first write
  const wrappedSubmitUserMessage = useCallback(async () => {
    return submitUserMessage();
  }, [submitUserMessage]);

  interface SessionView {
    _id: string;
    title: string;
    publishedUrl?: string;
    firehoseShared?: boolean;
  }

  const session: SessionView = useMemo(
    () => ({
      _id: sessionId,
      title: vibeDoc.title,
      publishedUrl: vibeDoc.publishedUrl,
      firehoseShared: vibeDoc.firehoseShared,
    }),
    [sessionId, vibeDoc.title, vibeDoc.publishedUrl, vibeDoc.firehoseShared],
  );

  return useMemo(
    () => ({
      // Session information
      session,
      docs,

      // Databases
      sessionDatabase,

      // Session management functions
      updateTitle,
      updatePublishedUrl,
      updateFirehoseShared,
      addScreenshot,
      // Message management
      userMessage,
      submitUserMessage: wrappedSubmitUserMessage,
      mergeUserMessage,
      aiMessage,
      submitAiMessage,
      mergeAiMessage,
      saveAiMessage,
      // Vibe document management
      vibeDoc,
      selectedModel: vibeDoc?.selectedModel,
      effectiveModel,
      updateDependencies,
      updateInstructionalTextOverride,
      updateDemoDataOverride,
      updateAiSelectedDependencies,
      updateSelectedModel,
    }),
    [
      session,
      docs,
      sessionDatabase,
      updateTitle,
      updatePublishedUrl,
      updateFirehoseShared,
      addScreenshot,
      userMessage,
      wrappedSubmitUserMessage,
      mergeUserMessage,
      aiMessage,
      submitAiMessage,
      mergeAiMessage,
      saveAiMessage,
      vibeDoc,
      effectiveModel,
      updateDependencies,
      updateInstructionalTextOverride,
      updateDemoDataOverride,
      updateAiSelectedDependencies,
      updateSelectedModel,
    ],
  );
}
