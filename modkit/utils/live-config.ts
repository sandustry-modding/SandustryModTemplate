export const LIVE_CONFIG_GLOBAL = "modkitLiveConfig";
export const LIVE_CONFIG_EVENT = "modkit:live-config";

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

export function humanizeLiveConfigKey(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function inferLiveConfigGroup(key: string): string {
  if (key === "debug" || key.startsWith("debug")) return "Debug";
  if (key.startsWith("pine")) return "Pine";
  if (key.startsWith("oak")) return "Oak";
  if (key.startsWith("wood")) return "Wood";
  if (key.startsWith("compost") || key.startsWith("dirt") || key.startsWith("wet"))
    return "Compost";
  if (key.startsWith("sieve")) return "Sieve";
  return "General";
}

export const LIVE_CONFIG_GROUP_ORDER = [
  "Debug",
  "Pine",
  "Oak",
  "Wood",
  "Compost",
  "Sieve",
  "General",
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
      label: extra.label ?? humanizeLiveConfigKey(key),
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

function broadcast(id: string, values: Record<string, LiveConfigValue>): void {
  try {
    sandkit.api.events.emit(LIVE_CONFIG_EVENT, { id, values: { ...values } });
  } catch {
    /* node tests and workers without main emit */
  }
}

export function createLiveConfig<T extends Record<string, LiveConfigValue>>(
  spec: LiveConfigSpec<T>,
): LiveConfigHandle<T> {
  const defaults = { ...spec.defaults };
  const fields = buildLiveConfigFields(defaults, spec.fields);
  let bound: T | undefined;

  function get(): T {
    const bag = globalThis as Record<string, unknown>;
    const current = bag[spec.globalKey];
    if (current === bound && bound) return bound;
    const next = { ...defaults };
    if (current && typeof current === "object") {
      overlay(next, current as Record<string, unknown>, defaults);
    }
    bag[spec.globalKey] = next;
    bound = next;
    return next;
  }

  function set<K extends keyof T>(key: K, value: T[K]): void {
    get()[key] = value;
    liveConfigRegistry().notify();
    broadcast(spec.id, get());
  }

  function reset(): void {
    const live = get();
    for (const key of Object.keys(defaults) as (keyof T)[]) live[key] = defaults[key];
    liveConfigRegistry().notify();
    broadcast(spec.id, live);
  }

  const config = new Proxy({} as T, {
    get(_target, prop) {
      const live = get();
      if (prop in live) return live[prop as keyof T];
      return defaults[prop as keyof T];
    },
    set(_target, prop, value) {
      set(prop as keyof T, value as T[keyof T]);
      return true;
    },
    ownKeys() {
      return Reflect.ownKeys(get());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Object.getOwnPropertyDescriptor(get(), prop);
    },
  });

  const handle: LiveConfigHandle<T> = {
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
      });
    },
  };

  get();
  liveConfigRegistry().register({
    id: spec.id,
    title: spec.title,
    globalKey: spec.globalKey,
    defaults,
    fields,
    get,
    set: (key, value) => set(key as keyof T, value as T[keyof T]),
    reset,
  });

  return handle;
}
