import React, { useState, useEffect, useRef } from "react";
import type { AIParams } from "@vibes.diy/api-types";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { filterModelsByUsage } from "./filterModelsByUsage.js";
import { toastError } from "./mine/sharing-tab/shared.js";

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
  usage: "codegen" | "runtime" | "img";
  saving: boolean;
  onSave: (cfg: AIParams) => void;
}) {
  const { sharedApi } = useVibesDiy();

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
    if (viewState.current === "start") {
      viewState.current = "loading";
      sharedApi.listModels({}).then((res) => {
        toastError(res, (data) => {
          viewState.current = "loaded";
          const eligible = filterModelsByUsage(data.models, usage);
          setModels(eligible);
          for (const model of eligible) {
            if (model.preSelected?.includes(usage))
              setAIParam((prev) => {
                if (!prev?.model) {
                  return { ...prev, model };
                }
                return prev;
              });
          }
        });
      });
      return;
    }
  }, [sharedApi, usage]);

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
  codegenConfig?: Partial<AIParams>;
  runtimeConfig?: Partial<AIParams>;
  imgConfig?: Partial<AIParams>;
  savingCodegen: boolean;
  savingRuntime: boolean;
  savingImg: boolean;
  onSaveCodegen: (cfg: AIParams) => void;
  onSaveRuntime: (cfg: AIParams) => void;
  onSaveImg: (cfg: AIParams) => void;
}

export function ModelSettingsCards({
  codegenConfig,
  runtimeConfig,
  imgConfig,
  savingCodegen,
  savingRuntime,
  savingImg,
  onSaveCodegen,
  onSaveRuntime,
  onSaveImg,
}: ModelSettingsCardsProps) {
  return (
    <>
      <Card title="Codegen Model">
        <ModelSection config={codegenConfig} usage="codegen" saving={savingCodegen} onSave={onSaveCodegen} />
      </Card>
      <Card title="App Runtime Model">
        <ModelSection config={runtimeConfig} usage="runtime" saving={savingRuntime} onSave={onSaveRuntime} />
      </Card>
      <Card title="Imaging Model">
        <ModelSection config={imgConfig} usage="img" saving={savingImg} onSave={onSaveImg} />
      </Card>
    </>
  );
}
