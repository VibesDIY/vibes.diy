export function defaultFetchPkgVersion(
  fn?: (pkg: string) => Promise<string | undefined>,
  url = "https://registry.npmjs.org"
): (pkg: string) => Promise<string | undefined> {
  if (fn) {
    return fn;
  }
  return (pkg: string) => {
    console.log(`[defaultFetchPkgVersion] using default with url: ${url}/${pkg}/latest`);
    return fetch(`${url}/${pkg}/latest`)
      .then((res) => {
        if (!res.ok) {
          return undefined;
        }
        return res.json().then((data) => data.version);
      })
      .catch(() => undefined);
  };
}
