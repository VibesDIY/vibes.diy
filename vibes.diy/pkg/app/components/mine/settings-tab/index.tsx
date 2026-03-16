import React, { useEffect, useState } from "react";
import type { AppConfig, ModelConfig } from "./types.js";
import { getModelOptions } from "./models.js";
import { useVibeDiy } from "../../../vibe-diy-provider.js";
import { isActiveTitle, isActiveModelSetting, isActiveEnv, toKVString, fromKVString } from "@vibes.diy/api-types";

// ── card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="font-medium text-gray-700 dark:text-gray-300 mb-3">{title}</div>
      {children}
    </li>
  );
}

// ── field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-24 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}

// ── save button ──────────────────────────────────────────────────────────────

function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={onClick}
      className="rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 disabled:opacity-50"
    >
      {saving ? "Saving…" : "Save"}
    </button>
  );
}

// ── model config section ─────────────────────────────────────────────────────

function ModelSection({ config, onSave }: { config: ModelConfig; onSave: (config: ModelConfig) => Promise<void> }) {
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setModel(config.model);
    setApiKey(config.apiKey);
  }, [config]);

  async function save() {
    setSaving(true);
    await onSave({ model, apiKey });
    setSaving(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="w-24 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
        >
          {getModelOptions().map((opt) => (
            <option key={opt.modelName} value={opt.modelName}>
              {opt.visibleModelName}
            </option>
          ))}
        </select>
      </div>
      <Field label="API Key" value={apiKey} onChange={setApiKey} placeholder="sk-…" type="password" />
      <div className="flex justify-end">
        <SaveBtn saving={saving} onClick={() => void save()} />
      </div>
    </div>
  );
}

// ── env CRUD ─────────────────────────────────────────────────────────────────

function EnvSection({
  env,
  onUpsert,
  onDelete,
}: {
  env: Record<string, string>;
  onUpsert: (key: string, value: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function add() {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key) return;
    setAdding(true);
    await onUpsert(key, value);
    setNewKey("");
    setNewValue("");
    setAdding(false);
  }

  async function remove(key: string) {
    setBusyKey(key);
    await onDelete(key);
    setBusyKey(null);
  }

  async function updateValue(key: string, value: string) {
    setBusyKey(key);
    await onUpsert(key, value);
    setBusyKey(null);
  }

  const keys = Object.keys(env);

  return (
    <div className="space-y-2">
      {keys.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-gray-400 dark:text-gray-500 font-medium pb-1 pr-3">Key</th>
              <th className="text-left text-gray-400 dark:text-gray-500 font-medium pb-1 pr-3">Value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <EnvRow
                key={k}
                envKey={k}
                value={env[k]}
                isBusy={busyKey === k}
                onSave={(v) => void updateValue(k, v)}
                onDelete={() => void remove(k)}
              />
            ))}
          </tbody>
        </table>
      )}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="KEY"
          className="w-32 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs font-mono text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="value"
          className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          type="button"
          disabled={adding || !newKey.trim()}
          onClick={() => void add()}
          className="rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 disabled:opacity-50"
        >
          {adding ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}

function EnvRow({
  envKey,
  value: initialValue,
  isBusy,
  onSave,
  onDelete,
}: {
  envKey: string;
  value: string;
  isBusy: boolean;
  onSave: (value: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const dirty = value !== initialValue;

  return (
    <tr className="border-t border-gray-100 dark:border-gray-800">
      <td className="py-1 pr-3 font-mono text-gray-700 dark:text-gray-300 align-middle">{envKey}</td>
      <td className="py-1 pr-2 align-middle">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
        />
      </td>
      <td className="py-1 align-middle">
        <div className="flex items-center gap-1">
          {dirty && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onSave(value)}
              className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 disabled:opacity-50"
            >
              {isBusy ? "…" : "Save"}
            </button>
          )}
          <button
            type="button"
            disabled={isBusy}
            onClick={onDelete}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs leading-none disabled:opacity-50"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── main tab ─────────────────────────────────────────────────────────────────

interface SettingsTabProps {
  userSlug: string;
  appSlug: string;
}

export function SettingsTab({ userSlug, appSlug }: SettingsTabProps) {
  const { vibeDiyApi } = useVibeDiy();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  useEffect(() => {
    setLoading(true);
    void vibeDiyApi.ensureAppSettings({ appSlug, userSlug }).then((res) => {
      const cfg: AppConfig = { title: "", chat: { model: "", apiKey: "" }, app: { model: "", apiKey: "" }, env: {} };
      if (res.isOk()) {
        const { entries } = res.Ok().settings;
        const titleEntry = entries.find(isActiveTitle);
        const chatEntry = entries.find((e) => isActiveModelSetting(e) && e.usage === "chat");
        const appEntry = entries.find((e) => isActiveModelSetting(e) && e.usage === "app");
        const envEntry = entries.find(isActiveEnv);
        if (titleEntry && isActiveTitle(titleEntry)) cfg.title = titleEntry.title;
        if (chatEntry && isActiveModelSetting(chatEntry)) cfg.chat = chatEntry.param;
        if (appEntry && isActiveModelSetting(appEntry)) cfg.app = appEntry.param;
        if (envEntry && isActiveEnv(envEntry)) cfg.env = fromKVString(envEntry.env);
      }
      setConfig(cfg);
      setTitle(cfg.title);
      setLoading(false);
    });
  }, [appSlug, userSlug, vibeDiyApi]);

  async function saveTitle() {
    if (!config) return;
    setSavingTitle(true);
    await vibeDiyApi.ensureAppSettings({ appSlug, userSlug, title });
    setConfig({ ...config, title });
    setSavingTitle(false);
  }

  async function saveModelConfig(target: "chat" | "app", cfg: ModelConfig) {
    const req = target === "chat" ? { appSlug, userSlug, chat: cfg } : { appSlug, userSlug, app: cfg };
    await vibeDiyApi.ensureAppSettings(req);
    setConfig((prev) => (prev ? { ...prev, [target]: cfg } : prev));
  }

  async function upsertEnv(key: string, value: string) {
    if (!config) return;
    const updated = { ...config.env, [key]: value };
    await vibeDiyApi.ensureAppSettings({ appSlug, userSlug, env: toKVString(updated) });
    setConfig({ ...config, env: updated });
  }

  async function deleteEnv(key: string) {
    if (!config) return;
    const { [key]: _, ...updated } = config.env;
    await vibeDiyApi.ensureAppSettings({ appSlug, userSlug, env: toKVString(updated) });
    setConfig({ ...config, env: updated });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (!config) return null;

  return (
    <ol className="space-y-5 text-sm">
      <Card title="General">
        <div className="space-y-2">
          <Field label="Title" value={title} onChange={setTitle} placeholder={appSlug} />
          <div className="flex justify-end">
            <SaveBtn saving={savingTitle} onClick={() => void saveTitle()} />
          </div>
        </div>
      </Card>

      <Card title="Chat Model">
        <ModelSection config={config.chat} onSave={(cfg) => saveModelConfig("chat", cfg)} />
      </Card>

      <Card title="App Model">
        <ModelSection config={config.app} onSave={(cfg) => saveModelConfig("app", cfg)} />
      </Card>

      <Card title="Environment Variables">
        <EnvSection env={config.env} onUpsert={upsertEnv} onDelete={deleteEnv} />
      </Card>
    </ol>
  );
}
