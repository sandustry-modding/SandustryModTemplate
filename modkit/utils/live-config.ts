export const LIVE_CONFIG_GLOBAL = "modkitLiveConfig";
export const LIVE_CONFIG_EVENT = "modkit:live-config";
export const LIVE_CONFIG_BUFFER_PREFIX = "modkit:live-config:";

export type LiveConfigValue = boolean | number;

export type LiveConfigFieldKind = "boolean" | "number";

export type LiveConfigField = {
  key: string;
  kind: LiveConfigFieldKind;
  label: string;
  description?: string;
  group: string;
  min?: number;
  max?: number;
  step?: number;
};

export type LiveConfigFieldOverride = {
  label?: string;
  description?: string;
  group?: string;
  min?: number;
  max?: number;
  step?: number;
};

export type LiveConfigSpec<T extends Record<string, LiveConfigValue>> = {
  id: string;
  title: string;
  globalKey: string;
  defaults: T;
  fields?: { [K in keyof T]?: LiveConfigFieldOverride };
};

export type LiveConfigHandle<T extends Record<string, LiveConfigValue>> = {
  id: string;
  title: string;
  globalKey: string;
  defaults: T;
  fields: LiveConfigField[];
  config: T;
  get(): T;
  set<K extends keyof T>(key: K, value: T[K]): void;
  reset(): void;
  listen(api: {
    events: {
      on(eventId: string, callback: (payload: unknown) => void, options?: object): () => void;
    };
  }): () => void;
};

export type LiveConfigEntry = {
  id: string;
  title: string;
  globalKey: string;
  defaults: Record<string, LiveConfigValue>;
  fields: LiveConfigField[];
  get(): Record<string, LiveConfigValue>;
  set(key: string, value: LiveConfigValue): void;
  reset(): void;
};

type Registry = {
  list: () => LiveConfigEntry[];
  register: (entry: LiveConfigEntry) => () => void;
  subscribe: (onChange: () => void) => () => void;
  notify: () => void;
};

type Host = typeof globalThis & {
  [LIVE_CONFIG_GLOBAL]?: Registry;
};

type LiveConfigScalar<V> = V extends boolean ? boolean : V extends number ? number : V;

type LiveConfigValues<T extends Record<string, LiveConfigValue>> = {
  [K in keyof T]: LiveConfigScalar<T[K]>;
};

type SharedBuffers = typeof sandkit.api.shared.buffers & {
  require?: typeof sandkit.api.shared.buffers.ensure;
};

function host(): Host {
  return globalThis as Host;
}

function overlay(
  target: Record<string, LiveConfigValue>,
  source: Record<string, unknown>,
  defaults: Record<string, LiveConfigValue>,
): void {
  for (const key of Object.keys(defaults)) {
    const value = source[key];
    if (typeof value === typeof defaults[key]) target[key] = value as LiveConfigValue;
  }
}

export function inferLiveConfigGroup(key: string): string {
  if (key === "debug" || key.startsWith("debug")) return "debug";
  if (key.startsWith("pine")) return "pine";
  if (key.startsWith("oak")) return "oak";
  if (key.startsWith("wood")) return "wood";
  if (key.startsWith("compost") || key.startsWith("dirt") || key.startsWith("wet")) return "compost";
  if (key.startsWith("sieve")) return "sieve";
  return "general";
}

export const LIVE_CONFIG_GROUP_ORDER = [
  "debug",
  "pine",
  "oak",
  "wood",
  "compost",
  "sieve",
  "general",
];

function inferNumberRange(
  key: string,
  value: number,
): { min?: number; max?: number; step?: number } {
  if (/chance/i.test(key) || /growStart/i.test(key)) {
    return { min: 0, max: 1, step: 0.001 };
  }
  if (Number.isInteger(value)) return { min: 0, step: 1 };
  return { step: 0.01 };
}

export function groupLiveConfigFields(
  fields: LiveConfigField[],
): { group: string; fields: LiveConfigField[] }[] {
  const buckets = new Map<string, LiveConfigField[]>();
  for (const field of fields) {
    const list = buckets.get(field.group) ?? [];
    list.push(field);
    buckets.set(field.group, list);
  }
  const ranked = LIVE_CONFIG_GROUP_ORDER.filter((group) => buckets.has(group));
  const extra = [...buckets.keys()].filter((group) => !LIVE_CONFIG_GROUP_ORDER.includes(group));
  return [...ranked, ...extra].map((group) => ({ group, fields: buckets.get(group) ?? [] }));
}

function formatLiveConfigValue(value: LiveConfigValue): string {
  if (typeof value === "boolean") return String(value);
  if (Number.isInteger(value)) return String(value);
  return Number(value.toPrecision(12)).toString();
}

/** TypeScript object literal for pasting into a createLiveConfig defaults block. */
export function formatLiveConfigDefaults(entry: LiveConfigEntry): string {
  const values = entry.get();
  const groups = groupLiveConfigFields(entry.fields);
  const lines: string[] = ["{"];
  const fieldCount = entry.fields.length;
  let written = 0;

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    if (groupIndex > 0) lines.push("");
    for (const field of groups[groupIndex].fields) {
      written += 1;
      const comma = written < fieldCount ? "," : "";
      lines.push(`  ${field.key}: ${formatLiveConfigValue(values[field.key] as LiveConfigValue)}${comma}`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

export function buildLiveConfigFields<T extends Record<string, LiveConfigValue>>(
  defaults: T,
  overrides?: { [K in keyof T]?: LiveConfigFieldOverride },
): LiveConfigField[] {
  return (Object.keys(defaults) as (keyof T & string)[]).map((key) => {
    const value = defaults[key];
    const extra = overrides?.[key] ?? {};
    const kind: LiveConfigFieldKind = typeof value === "boolean" ? "boolean" : "number";
    const range = kind === "number" ? inferNumberRange(key, value as number) : {};
    return {
      key,
      kind,
      label: extra.label ?? key,
      description: extra.description,
      group: extra.group ?? inferLiveConfigGroup(key),
      min: extra.min ?? range.min,
      max: extra.max ?? range.max,
      step: extra.step ?? range.step,
    };
  });
}

function createRegistry(): Registry {
  const entries = new Map<string, LiveConfigEntry>();
  const listeners = new Set<() => void>();
  return {
    list() {
      return [...entries.values()];
    },
    register(entry) {
      entries.set(entry.id, entry);
      this.notify();
      return () => {
        if (entries.get(entry.id) === entry) entries.delete(entry.id);
        this.notify();
      };
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    notify() {
      for (const fn of listeners) fn();
    },
  };
}

export function liveConfigRegistry(): Registry {
  const g = host();
  if (!g[LIVE_CONFIG_GLOBAL]) g[LIVE_CONFIG_GLOBAL] = createRegistry();
  return g[LIVE_CONFIG_GLOBAL];
}

export function listLiveConfigs(): LiveConfigEntry[] {
  return liveConfigRegistry().list();
}

export function subscribeLiveConfig(onChange: () => void): () => void {
  return liveConfigRegistry().subscribe(onChange);
}

function sharedBuffers(): SharedBuffers | null {
  try {
    const buffers = sandkit.api.shared.buffers;
    return buffers ?? null;
  } catch {
    return null;
  }
}

function asFloat64(value: unknown): Float64Array | null {
  return value instanceof Float64Array ? value : null;
}

function broadcast(id: string, values: Record<string, LiveConfigValue>): void {
  try {
    sandkit.api.events.emit(LIVE_CONFIG_EVENT, { id, values: { ...values } });
  } catch {
    /* node tests and workers without main emit */
  }
}

export function createLiveConfig<T extends Record<string, LiveConfigValue>>(
  spec: LiveConfigSpec<T>,
): LiveConfigHandle<LiveConfigValues<T>> {
  type Config = LiveConfigValues<T>;
  const defaults = { ...spec.defaults } as Config;
  const keys = Object.keys(defaults) as (keyof Config & string)[];
  const fields = buildLiveConfigFields(spec.defaults, spec.fields);
  const bufferKey = `${LIVE_CONFIG_BUFFER_PREFIX}${spec.id}`;
  const bufferLength = 1 + keys.length;
  let bound: Config | undefined;
  let view: Float64Array | null = null;
  let lastGen = 0;
  let writable = false;

  function attachView(): Float64Array | null {
    if (view) return view;
    const buffers = sharedBuffers();
    if (!buffers) return null;
    const config = { type: "float64" as const, length: bufferLength };
    try {
      if (typeof buffers.ensure === "function") {
        view = asFloat64(buffers.ensure(bufferKey, config));
        writable = Boolean(view);
      } else if (typeof buffers.require === "function") {
        view = asFloat64(buffers.require(bufferKey, config));
      } else if (typeof buffers.get === "function") {
        view = asFloat64(buffers.get(bufferKey));
      }
    } catch {
      return null;
    }
    return view;
  }

  function pushShared(live: Config): void {
    const sab = attachView();
    if (!sab || !writable) return;
    sab[0] += 1;
    if (sab[0] === 0) sab[0] = 1;
    for (let i = 0; i < keys.length; i += 1) {
      const value = live[keys[i]];
      sab[i + 1] = typeof value === "boolean" ? (value ? 1 : 0) : Number(value);
    }
    lastGen = sab[0];
  }

  function pullShared(live: Config): void {
    const sab = attachView();
    if (!sab) return;
    const gen = sab[0];
    if (!gen || gen === lastGen) return;
    lastGen = gen;
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const raw = sab[i + 1];
      if (!Number.isFinite(raw)) continue;
      if (typeof defaults[key] === "boolean") {
        live[key] = (raw !== 0) as Config[typeof key];
      } else {
        live[key] = raw as Config[typeof key];
      }
    }
  }

  function get(): Config {
    const bag = globalThis as Record<string, unknown>;
    const current = bag[spec.globalKey];
    if (!bound) bound = { ...defaults };
    if (current && typeof current === "object" && current !== bound) {
      overlay(bound, current as Record<string, unknown>, defaults);
      bag[spec.globalKey] = bound;
      pushShared(bound);
      return bound;
    }
    bag[spec.globalKey] = bound;
    pullShared(bound);
    return bound;
  }

  function publish(live: Config): void {
    pushShared(live);
    liveConfigRegistry().notify();
    broadcast(spec.id, live);
  }

  function set<K extends keyof Config>(key: K, value: Config[K]): void {
    const live = get();
    live[key] = value;
    publish(live);
  }

  function reset(): void {
    const live = get();
    for (const key of Object.keys(defaults) as (keyof Config)[]) live[key] = defaults[key];
    publish(live);
  }

  const config = new Proxy({} as Config, {
    get(_target, prop) {
      const live = get();
      if (prop in live) return live[prop as keyof Config];
      return defaults[prop as keyof Config];
    },
    set(_target, prop, value) {
      set(prop as keyof Config, value as Config[keyof Config]);
      return true;
    },
    ownKeys() {
      return Reflect.ownKeys(get());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Object.getOwnPropertyDescriptor(get(), prop);
    },
  });

  const handle: LiveConfigHandle<Config> = {
    id: spec.id,
    title: spec.title,
    globalKey: spec.globalKey,
    defaults,
    fields,
    config,
    get,
    set,
    reset,
    listen(api) {
      return api.events.on(LIVE_CONFIG_EVENT, (payload) => {
        if (!payload || typeof payload !== "object") return;
        const body = payload as { id?: unknown; values?: unknown };
        if (body.id !== spec.id) return;
        if (!body.values || typeof body.values !== "object") return;
        overlay(get(), body.values as Record<string, unknown>, defaults);
        publish(get());
      });
    },
  };

  const initial = get();
  pushShared(initial);
  liveConfigRegistry().register({
    id: spec.id,
    title: spec.title,
    globalKey: spec.globalKey,
    defaults,
    fields,
    get,
    set: (key, value) => set(key as keyof Config, value as Config[keyof Config]),
    reset,
  });

  return handle;
}
