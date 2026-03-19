import React, { useEffect, useState } from "react";
import { getModelOptions } from "../../../data/models.js";
import { useVibesDiy } from "../../../vibes-diy-provider.js";
import { fromKVString, toKVString, AIParams } from "@vibes.diy/api-types";
import { toast } from "react-hot-toast";

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

function ModelSection({
  config,
  saving,
  onSave,
}: {
  config?: Partial<AIParams>;
  saving: boolean;
  onSave: (cfg: AIParams) => void;
}) {
  const models = getModelOptions();
  const [model, setModel] = useState(config?.model ?? "");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const selected = models.find((o) => o.name === model) ?? models[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="w-24 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
        >
          {models.map((opt) => (
            <option key={opt.id} value={opt.name}>
              {opt.id}
            </option>
          ))}
        </select>
      </div>
      {selected?.description && (
        <p className="pl-[calc(1.5rem+6rem)] text-xs text-gray-400 dark:text-gray-500 italic">{selected.description}</p>
      )}
      <Field label="API Key" value={apiKey} onChange={setApiKey} placeholder="sk-…" type="password" />
      <div className="flex justify-end">
        <SaveBtn saving={saving} onClick={() => onSave({ model, apiKey })} />
      </div>
    </div>
  );
}

// ── env CRUD ─────────────────────────────────────────────────────────────────

function EnvSection({
  env,
  saving,
  onUpsert,
  onDelete,
}: {
  env: Record<string, string>;
  saving: boolean;
  onUpsert: (key: string, value: string) => void;
  onDelete: (key: string) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  function add() {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key) return;
    onUpsert(key, value);
    setNewKey("");
    setNewValue("");
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
                isBusy={saving}
                onSave={(v) => onUpsert(k, v)}
                onDelete={() => onDelete(k)}
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
          disabled={saving || !newKey.trim()}
          onClick={add}
          className="rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 disabled:opacity-50"
        >
          {saving ? "…" : "Add"}
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

// ── pending update ────────────────────────────────────────────────────────────

type SettingsUpdate =
  | { kind: "fetch"; appSlug: string; userSlug: string }
  | { kind: "title"; appSlug: string; userSlug: string; title: string }
  | { kind: "chat"; appSlug: string; userSlug: string; chat: AIParams }
  | { kind: "app"; appSlug: string; userSlug: string; app: AIParams }
  | { kind: "env"; appSlug: string; userSlug: string; env: Record<string, string> };

// ── main tab ─────────────────────────────────────────────────────────────────

interface SettingsTabProps {
  userSlug: string;
  appSlug: string;
}

export function SettingsTab({ userSlug, appSlug }: SettingsTabProps) {
  const { vibeDiyApi } = useVibesDiy();

  const [title, setTitle] = useState("");
  const [chatConfig, setChatConfig] = useState<Partial<AIParams>>({});
  const [appConfig, setAppConfig] = useState<Partial<AIParams>>({});
  const [env, setEnv] = useState<Record<string, string>>({});

  const [pending, setPending] = useState<SettingsUpdate>({ kind: "fetch", appSlug, userSlug });
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingChat, setSavingChat] = useState(false);
  const [savingApp, setSavingApp] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reset to a fresh fetch whenever the app identity changes.
  useEffect(() => {
    setPending({ kind: "fetch", appSlug, userSlug });
  }, [appSlug, userSlug, vibeDiyApi]);

  // Single effect: handles initial fetch + every update.
  // pending embeds appSlug/userSlug so deps stay stable at [pending, vibeDiyApi].
  useEffect(() => {
    let alive = true;

    if (pending.kind === "title") setSavingTitle(true);
    else if (pending.kind === "chat") setSavingChat(true);
    else if (pending.kind === "app") setSavingApp(true);
    else if (pending.kind === "env") setSavingEnv(true);
    else setLoading(true);

    const base = { appSlug: pending.appSlug, userSlug: pending.userSlug };
    const req =
      pending.kind === "title"
        ? { ...base, title: pending.title }
        : pending.kind === "chat"
          ? { ...base, chat: pending.chat }
          : pending.kind === "app"
            ? { ...base, app: pending.app }
            : pending.kind === "env"
              ? { ...base, env: toKVString(pending.env) }
              : base;

    void vibeDiyApi.ensureAppSettings(req).then((res) => {
      if (!alive) return;

      if (pending.kind === "title") setSavingTitle(false);
      else if (pending.kind === "chat") setSavingChat(false);
      else if (pending.kind === "app") setSavingApp(false);
      else if (pending.kind === "env") setSavingEnv(false);
      else setLoading(false);

      if (res.isErr()) {
        toast.error(res.Err().message);
        return;
      }

      const s = res.Ok().settings;
      console.log("Settings saved/fetched successfully:", s.entry.settings);
      setTitle(s.entry.settings.title ?? "");
      setChatConfig(s.entry.settings.chat ?? {});
      setAppConfig(s.entry.settings.app ?? {});
      setEnv(fromKVString(s.entry.settings.env ?? []));

      if (pending.kind !== "fetch") toast.success("Saved");
    });

    return () => {
      alive = false;
    };
  }, [pending, vibeDiyApi]);

  function upsertEnv(key: string, value: string) {
    const updated = { ...env, [key]: value };
    setEnv(updated);
    setPending({ kind: "env", appSlug, userSlug, env: updated });
  }

  function deleteEnv(key: string) {
    const { [key]: _, ...updated } = env;
    setEnv(updated);
    setPending({ kind: "env", appSlug, userSlug, env: updated });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <ol className="space-y-5 text-sm">
      <Card title="General">
        <div className="space-y-2">
          <Field label="Title" value={title} onChange={setTitle} placeholder={appSlug} />
          <div className="flex justify-end">
            <SaveBtn saving={savingTitle} onClick={() => setPending({ kind: "title", appSlug, userSlug, title })} />
          </div>
        </div>
      </Card>

      <Card title="Chat Model">
        <ModelSection
          config={chatConfig}
          saving={savingChat}
          onSave={(cfg) => setPending({ kind: "chat", appSlug, userSlug, chat: cfg })}
        />
      </Card>

      <Card title="App Model">
        <ModelSection
          config={appConfig}
          saving={savingApp}
          onSave={(cfg) => setPending({ kind: "app", appSlug, userSlug, app: cfg })}
        />
      </Card>

      <Card title="Environment Variables">
        <EnvSection env={env} saving={savingEnv} onUpsert={upsertEnv} onDelete={deleteEnv} />
      </Card>
    </ol>
  );
}
