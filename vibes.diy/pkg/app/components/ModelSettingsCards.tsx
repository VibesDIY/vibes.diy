import React, { useState, useEffect, useRef } from "react";
import type { AIParams } from "@vibes.diy/api-types";
import { useVibesDiy } from "../vibes-diy-provider.js";

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
      className="rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
      style={{
        background: "transparent",
        color: "var(--vibes-card-text)",
        border: "1px solid var(--vibes-card-border)",
      }}
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

  const viewState = useRef<"start" | "loading" | "loaded">("start");

  const [aiParam, setAIParam] = useState<AIParams>({
    model: {
      id: "loading-model",
      name: "loading...",
      description: "we wait for the models to load",
    },
    ...config,
  });

  useEffect(() => {
    console.log("ModelSection useEffect triggered with usage:", usage, "and config:", config, viewState);
    if (viewState.current === "start") {
      viewState.current = "loading";
      vibeDiyApi.listModels({}).then((res) => {
        viewState.current = "loaded";
        if (res.isOk()) {
          setModels(res.Ok().models);
          for (const model of res.Ok().models) {
            if (model.preSelected?.includes(usage))
              setAIParam((prev) => {
                if (!prev?.model) {
                  return { ...prev, model };
                }
                return prev;
              });
          }
        }
      });
      return;
    }
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
        {viewState.current !== "loaded" && <div className="text-xs text-gray-400">Loading models...</div>}
        {viewState.current === "loaded" && (
          <select
            value={aiParam?.model.id || ""}
            onChange={(e) =>
              setAIParam((prev) => (prev ? { ...prev, model: models.find((m) => m.id === e.target.value) || prev.model } : prev))
            }
            className="flex-1 rounded px-2 py-1 text-xs outline-none"
            style={{
              border: "1px solid var(--vibes-card-border)",
              background: "var(--vibes-card-bg)",
              color: "var(--vibes-card-text)",
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px rgba(128,128,128,0.3)"; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
          >
            {models.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {viewState.current === "loaded" && (
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
              className="flex-1 rounded px-2 py-1 text-xs outline-none"
              style={{
                border: "1px solid var(--vibes-card-border)",
                background: "var(--vibes-card-bg)",
                color: "var(--vibes-card-text)",
              }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px rgba(128,128,128,0.3)"; }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
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
