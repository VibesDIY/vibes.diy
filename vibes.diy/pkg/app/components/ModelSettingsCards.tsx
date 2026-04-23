import React, { useState, useEffect, useRef } from "react";
import type { AIParams } from "@vibes.diy/api-types";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { filterModelsByUsage } from "./filterModelsByUsage.js";

const cardControlClassName =
  "flex-1 rounded border border-[color:var(--vibes-card-border)] bg-[var(--vibes-card-bg)] px-2 py-1 text-xs text-[color:var(--vibes-card-text)] outline-none focus-visible:ring-2 focus-visible:ring-[rgba(128,128,128,0.3)]";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="font-medium text-gray-700 dark:text-gray-300 mb-3">{title}</div>
      {children}
    </li>
  );
}

function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={onClick}
      className="rounded border border-[color:var(--vibes-card-border)] bg-transparent px-2 py-1 text-xs font-medium text-[color:var(--vibes-card-text)] outline-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[rgba(128,128,128,0.3)]"
    >
      {saving ? "Saving…" : "Save"}
    </button>
  );
}

function ModelSection({
  config,
  usage,
  saving,
  onSave,
}: {
  config?: Partial<AIParams>;
  usage: "chat" | "app" | "img";
  saving: boolean;
  onSave: (cfg: AIParams) => void;
}) {
  const { vibeDiyApi } = useVibesDiy();

  const [models, setModels] = useState<AIParams["model"][]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const didStart = useRef(false);

  const [aiParam, setAIParam] = useState<AIParams>({
    model: {
      id: "loading-model",
      name: "loading...",
      description: "we wait for the models to load",
    },
    ...config,
  });

  useEffect(() => {
    if (didStart.current) return;
    didStart.current = true;
    vibeDiyApi
      .listModels({})
      .then((res) => {
        if (res.isOk()) {
          const eligible = filterModelsByUsage(res.Ok().models, usage);
          setModels(eligible);
          setLoadState("loaded");
          for (const model of eligible) {
            if (model.preSelected?.includes(usage))
              setAIParam((prev) => {
                if (!prev?.model) {
                  return { ...prev, model };
                }
                return prev;
              });
          }
        } else {
          const err = res.Err();
          const message = typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message) : String(err);
          setLoadError(message);
          setLoadState("error");
        }
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoadState("error");
      });
  }, [vibeDiyApi, usage]);

  useEffect(() => {
    setAIParam({
      model: {
        id: "loading-model",
        name: "loading...",
        description: "we wait for the models to load",
      },
      ...config,
    });
  }, [config]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="w-24 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">Model</label>
        {loadState === "loading" && <div className="text-xs text-gray-400">Loading models...</div>}
        {loadState === "error" && (
          <div className="flex-1 text-xs text-red-600 dark:text-red-400">Failed to load models: {loadError}</div>
        )}
        {loadState === "loaded" && models.length === 0 && (
          <div className="flex-1 text-xs text-gray-500 dark:text-gray-400">No models available for this usage.</div>
        )}
        {loadState === "loaded" && models.length > 0 && (
          <select
            value={aiParam?.model.id || ""}
            onChange={(e) =>
              setAIParam((prev) => (prev ? { ...prev, model: models.find((m) => m.id === e.target.value) || prev.model } : prev))
            }
            className={cardControlClassName}
          >
            {models.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {loadState === "loaded" && models.length > 0 && (
        <>
          {aiParam?.model.description && (
            <div className="flex items-center gap-3">
              <div className="w-24 flex-shrink-0" />
              <p className="flex-1 text-xs text-gray-400 dark:text-gray-500 italic truncate">{aiParam.model.description}</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="w-24 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">API Key</label>
            <input
              type="password"
              value={aiParam?.apiKey ?? ""}
              onChange={(e) => setAIParam((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-…"
              className={cardControlClassName}
            />
          </div>
          <div className="flex justify-end">
            <SaveBtn saving={saving} onClick={() => aiParam && onSave(aiParam)} />
          </div>
        </>
      )}
    </div>
  );
}

export interface ModelSettingsCardsProps {
  chatConfig?: Partial<AIParams>;
  appConfig?: Partial<AIParams>;
  imgConfig?: Partial<AIParams>;
  savingChat: boolean;
  savingApp: boolean;
  savingImg: boolean;
  onSaveChat: (cfg: AIParams) => void;
  onSaveApp: (cfg: AIParams) => void;
  onSaveImg: (cfg: AIParams) => void;
}

export function ModelSettingsCards({
  chatConfig,
  appConfig,
  imgConfig,
  savingChat,
  savingApp,
  savingImg,
  onSaveChat,
  onSaveApp,
  onSaveImg,
}: ModelSettingsCardsProps) {
  return (
    <>
      <Card title="Chat Model">
        <ModelSection config={chatConfig} usage="chat" saving={savingChat} onSave={onSaveChat} />
      </Card>
      <Card title="App Model">
        <ModelSection config={appConfig} usage="app" saving={savingApp} onSave={onSaveApp} />
      </Card>
      <Card title="Imaging Model">
        <ModelSection config={imgConfig} usage="img" saving={savingImg} onSave={onSaveImg} />
      </Card>
    </>
  );
}
