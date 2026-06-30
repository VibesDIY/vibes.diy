export interface SuperThisLike {
  env: {
    get(key: string): string | undefined;
  };
}

export function ensureSuperThisLike(): SuperThisLike {
  return {
    env: {
      get: (key: string) => process.env[key],
    },
  };
}
