export async function whoami(_args: string[]): Promise<void> {
  console.error("Not logged in. Run: use-vibes login");
  process.exit(1);
}
