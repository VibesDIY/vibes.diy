import React, { useState, useEffect, useRef } from "react";
import type { AIParams, Model } from "@vibes.diy/api-types";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { filterModelsByUsage } from "./filterModelsByUsage.js";
import { toastError } from "./mine/sharing-tab/shared.js";

const cardControlClassName =
  "flex-1 rounded border border-[color:var(--vibes-card-border)] bg-[var(--vibes-card-bg)] px-2 py-1 text-xs text-[color:var(--vibes-card-text)] outline-none focus-visible:ring-2 focus-visible:ring-[rgba(128,128,128,0.3)]";

const LOADING_MODEL: Model = {
  id: "loading-model",
  name: "loading...",
  description: "we wait for the models to load",
};

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

function ResetBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={onClick}
      className="rounded border border-transparent bg-transparent px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 underline outline-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[rgba(128,128,128,0.3)]"
    >
      Use default
    </button>
  );
}

function ModelSection({
  config,
  usage,
  saving,
  onSave,
  onReset,
}: {
  config?: Partial<AIParams>;
  usage: "codegen" | "runtime" | "img";
  saving: boolean;
  onSave: (cfg: AIParams) => void;
  // When provided, the card shows pinned-vs-default state and a "Use default"
  // control that clears the pin. Omitted by callers (e.g. per-app overrides)
  // that don't have follow-the-default semantics.
  onReset?: () => void;
}) {
  const { sharedApi } = useVibesDiy();

  const [models, setModels] = useState<Model[]>([]);
  // The catalog default for this usage (model with preSelected including `usage`).
  // Shown so the user can see what "follow the default" resolves to today, and
  // used as the selected model while the user is following the default.
  const [defaultModel, setDefaultModel] = useState<Model | undefined>();

  const viewState = useRef<"start" | "loading" | "loaded">("start");

  // A usage is "pinned" when the saved user setting carries a model for it.
  // Following the default means there is no entry (config has no model), so
  // resolution falls through to the live catalog default.
  const isPinned = !!config?.model;

  // Local editing state: the model the user has currently selected (may differ
  // from the saved config until Save), plus the optional per-usage API key.
  const [selectedId, setSelectedId] = useState<string | undefined>(config?.model?.id);
  const [apiKey, setApiKey] = useState<string>(config?.apiKey ?? "");

  useEffect(() => {
    if (viewState.current === "start") {
      viewState.current = "loading";
      sharedApi.listModels({}).then((res) => {
        toastError(res, (data) => {
          viewState.current = "loaded";
          const eligible = filterModelsByUsage(data.models, usage);
          setModels(eligible);
          setDefaultModel(eligible.find((m) => m.preSelected?.includes(usage)));
        });
      });
      return;
    }
  }, [sharedApi, usage]);

  // Reset the local editing state whenever the saved config changes (load,
  // save, or reset). When unpinned, selectedId is undefined so the select
  // falls back to the catalog default below.
  useEffect(() => {
    setSelectedId(config?.model?.id);
    setApiKey(config?.apiKey ?? "");
  }, [config]);

  const loaded = viewState.current === "loaded";
  // The model shown/selected: the user's local pick, else the saved pin, else
  // the catalog default (when following the default).
  const selectedModel = models.find((m) => m.id === selectedId) ?? config?.model ?? defaultModel ?? LOADING_MODEL;

  const handleSave = () => {
    const model = models.find((m) => m.id === selectedModel.id) ?? selectedModel;
    // Always send apiKey (even ""), never drop it: the per-app SettingsTab path
    // merges params field-by-field (ensureAppSettings: { ...prev.param, ...req }),
    // so omitting a cleared key would leave the old one stored and in use.
    onSave({ model, apiKey });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="w-24 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">Model</label>
        {!loaded && <div className="text-xs text-gray-400">Loading models...</div>}
        {loaded && (
          <select value={selectedModel.id} onChange={(e) => setSelectedId(e.target.value)} className={cardControlClassName}>
            {models.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {loaded && (
        <>
          {onReset && (
            <div className="flex items-center gap-3">
              <div className="w-24 flex-shrink-0" />
              <p className="flex-1 text-xs text-gray-400 dark:text-gray-500 italic truncate">
                {isPinned ? (
                  <>
                    Pinned to <span className="font-medium">{config?.model?.name}</span>
                    {defaultModel && ` · Default: ${defaultModel.name}`}
                  </>
                ) : (
                  <>Following default{defaultModel && ` (currently ${defaultModel.name})`}</>
                )}
              </p>
            </div>
          )}
          {selectedModel.description && (
            <div className="flex items-center gap-3">
              <div className="w-24 flex-shrink-0" />
              <p className="flex-1 text-xs text-gray-400 dark:text-gray-500 italic truncate">{selectedModel.description}</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="w-24 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              className={cardControlClassName}
            />
          </div>
          <div className="flex justify-end gap-2">
            {onReset && isPinned && <ResetBtn saving={saving} onClick={onReset} />}
            <SaveBtn saving={saving} onClick={handleSave} />
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
  onResetCodegen?: () => void;
  onResetRuntime?: () => void;
  onResetImg?: () => void;
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
  onResetCodegen,
  onResetRuntime,
  onResetImg,
}: ModelSettingsCardsProps) {
  return (
    <>
      <Card title="Codegen Model">
        <ModelSection
          config={codegenConfig}
          usage="codegen"
          saving={savingCodegen}
          onSave={onSaveCodegen}
          onReset={onResetCodegen}
        />
      </Card>
      <Card title="App Runtime Model">
        <ModelSection
          config={runtimeConfig}
          usage="runtime"
          saving={savingRuntime}
          onSave={onSaveRuntime}
          onReset={onResetRuntime}
        />
      </Card>
      <Card title="Imaging Model">
        <ModelSection config={imgConfig} usage="img" saving={savingImg} onSave={onSaveImg} onReset={onResetImg} />
      </Card>
    </>
  );
}
