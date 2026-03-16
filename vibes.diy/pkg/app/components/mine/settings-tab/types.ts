export interface ModelConfig {
  model: string;
  apiKey: string;
}

export interface AppConfig {
  title: string;
  chat: ModelConfig;
  app: ModelConfig;
  env: Record<string, string>;
}

export type Env = Record<string, string>;
