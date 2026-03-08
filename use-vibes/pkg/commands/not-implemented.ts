export function notImplemented(name: string): (args: string[]) => Promise<void> {
  return async (_args: string[]): Promise<void> => {
    console.error(`use-vibes ${name}: not yet implemented`);
    process.exit(1);
  };
}
