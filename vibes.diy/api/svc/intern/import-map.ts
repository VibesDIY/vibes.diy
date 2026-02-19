import { BuildURI, NPMPackage, Result, toSortedObject } from "@adviser/cement";
import * as semver from "semver";
import { defaultFetchPkgVersion } from "../npm-package-version.js";

interface NoneVersion {
  type: "NONE";
}

interface SymbolicOrSemVersion {
  type: "SYMBOLIC" | "SEMVER";
  value: string; // e.g., "LATEST"
}

interface ResolvedVersion {
  type: "RESOLVED";
  value: string; // e.g., "1.2.3"
  result: { src: string; version: string }; // the result from fetchVersion
  prev: VersionType; // the original version type before resolution, e.g., { type: "SYMBOLIC", value: "LATEST" }
}

interface ErrorVersion {
  type: "ERROR";
  value: string; // e.g., "1.2.3"
  error: Error;
  prev: VersionType; // the original version type before resolution, e.g., { type: "SYMBOLIC", value: "LATEST" }
}

type VersionType = NoneVersion | SymbolicOrSemVersion | ResolvedVersion | ErrorVersion;

interface MutableVersionEntity {
  givenVersion: string; // the original version string provided, e.g., "version:1.2.3,deps:react,privateNpm"
  version: VersionType;
  privateNpm: boolean; // true if "privateNpm:" is present
  deps: string[]; // array of dependencies, e.g., ["deps:react", "deps:react-dom"]
}

export class Version implements Readonly<MutableVersionEntity> {
  public readonly givenVersion: string;
  public readonly version: MutableVersionEntity["version"];
  public readonly privateNpm: boolean; // true if "privateNpm:" is present
  public readonly deps: string[]; // always an array, e.g., ["react", "react-dom"]

  static parse(givenVersion: string): Version {
    const parts = givenVersion.split(",");
    const result: MutableVersionEntity = {
      givenVersion,
      version: { type: "NONE" },
      privateNpm: false,
      deps: [],
    };

    for (const part of parts) {
      const trimmed = part.trim();
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        if (!trimmed) continue;
        // No colon, might be a semver string
        const parsed = semver.valid(trimmed);
        if (parsed) {
          result.version = { type: "SEMVER", value: parsed };
        } else {
          // Bare non-semver token treated as a dependency
          result.deps.push(trimmed);
        }
        continue;
      }

      const key = trimmed.slice(0, colonIndex);
      const value = trimmed.slice(colonIndex + 1);

      if (key === "deps") {
        result.deps.push(value);
      } else if (key === "version") {
        const versionValue = value || "LATEST";
        if (versionValue === "LATEST") {
          result.version = { type: "SYMBOLIC", value: "LATEST" };
        } else {
          result.version = { type: "SYMBOLIC", value: versionValue };
        }
        // Also check if it's a semver
        try {
          const parsed = semver.valid(versionValue);
          if (parsed) {
            result.version = { type: "SEMVER", value: parsed };
          }
        } catch {
          // Not a valid semver, ignore
        }
      } else if (key === "privateNpm") {
        result.privateNpm = true;
      }
    }
    if (result.privateNpm && result.version.type !== "NONE") {
      throw new Error(`Cannot combine version: and privateNpm: in ${JSON.stringify(givenVersion)}`);
    }
    return new Version(result);
  }

  constructor({ givenVersion, version, privateNpm, deps }: Readonly<MutableVersionEntity>) {
    this.givenVersion = givenVersion;
    this.version = version;
    this.privateNpm = privateNpm;
    this.deps = deps;
  }
}

export class Dependency {
  public readonly pkg: string;
  public readonly pkgs = new Map<
    string,
    {
      pkg: NPMPackage;
      version: {
        ver: Version;
        dependencies: Map<string, Dependency>;
      };
    }
  >(); // Map of full givenPkg to NPMPackage object for all variants of this package
  public readonly groups = new Set<string>();

  constructor(pkg: string) {
    this.pkg = pkg;
  }

  addPkg(pkg: NPMPackage, version: Version) {
    if (pkg.pkg !== this.pkg) {
      throw new Error(`Package mismatch: expected ${this.pkg}, got ${pkg.pkg}`);
    }
    this.pkgs.set(pkg.givenPkg, { pkg, version: { ver: version, dependencies: new Map() } });
  }

  addGroup(group: string) {
    this.groups.add(group);
  }
}

export class Dependencies {
  #byDeps = new Map<string, Dependency>();
  #byGroups = new Map<string, Map<string, Dependency>>();

  static from(deps: Record<string, string | Record<string, string>>): Dependencies {
    const dependencies = new Dependencies();
    for (const [key, val] of Object.entries(deps)) {
      if (typeof val === "string") {
        dependencies.add(key, val);
      }
      if (typeof val === "object") {
        for (const [gkey, gval] of Object.entries(val)) {
          dependencies.add(gkey, gval, key);
        }
      }
    }
    return dependencies;
  }

  addDep(dep: Dependency): Dependency {
    let existing = this.#byDeps.get(dep.pkg);
    if (!existing) {
      this.#byDeps.set(dep.pkg, dep);
      existing = dep;
    }
    return existing;
  }
  add(pkg: string, versionStr: string, group?: string): Dependency {
    const pkgParsed = NPMPackage.parse(pkg);
    const versionParsed = Version.parse(versionStr);

    let dependency = this.#byDeps.get(pkgParsed.pkg);
    if (!dependency) {
      dependency = new Dependency(pkgParsed.pkg);
      this.#byDeps.set(pkgParsed.pkg, dependency);
    }
    dependency.addPkg(pkgParsed, versionParsed);
    if (group) {
      let groupMap = this.#byGroups.get(group);
      if (!groupMap) {
        groupMap = new Map<string, Dependency>();
        this.#byGroups.set(group, groupMap);
      }
      groupMap.set(pkgParsed.pkg, dependency);
      dependency.addGroup(group);
    }
    return dependency;
  }

  async resolveVersion(
    resolveFn: (pkg: { pkg: NPMPackage; version: { ver: Version } }) => Promise<Result<{ src: string; version: string }>>
  ) {
    this.resolveVersionDeps();
    const fetches: Promise<ResolvedVersion | ErrorVersion>[] = [];
    for (const dep of this.#byDeps.values()) {
      for (const { pkg, version } of dep.pkgs.values()) {
        if (version.ver.version.type === "SYMBOLIC") {
          fetches.push(
            resolveFn({
              pkg,
              version: version,
            }).then((result) => {
              if (result.isErr()) {
                (version.ver as { version: ErrorVersion }).version = {
                  type: "ERROR",
                  value: (version.ver.version as SymbolicOrSemVersion).value,
                  error: result.Err(),
                  prev: version.ver.version,
                };
                return version.ver.version as ErrorVersion;
              }
              (version.ver as { version: ResolvedVersion }).version = {
                type: "RESOLVED",
                value: result.Ok().version,
                result: result.Ok(),
                prev: version.ver.version,
              };
              return version.ver.version as ResolvedVersion;
            })
          );
        }
      }
    }
    return Promise.all(fetches);
  }

  resolveVersionDeps() {
    for (const dep of this.#byDeps.values()) {
      for (const { version } of dep.pkgs.values()) {
        // console.log(`Resolving dependencies for ${dep.pkg} version ${version.ver.deps} -- ${version.ver.givenVersion}`);
        for (const verDep of version.ver.deps) {
          const isGroup = this.#byGroups.get(verDep);
          if (isGroup) {
            for (const groupItem of isGroup.values()) {
              version.dependencies.set(groupItem.pkg, groupItem);
            }
          }
          let isPkg = this.#byDeps.get(verDep);
          if (!isPkg) {
            isPkg = this.add(verDep, "version:");
          }
          version.dependencies.set(isPkg.pkg, isPkg);
        }
      }
    }
  }

  async renderImportMap({
    resolveFn,
    renderRHS,
  }: {
    resolveFn: (dep: { pkg: NPMPackage; version: { ver: Version } }) => Promise<Result<{ src: string; version: string }>>;
    renderRHS: (
      pkg: NPMPackage,
      version: {
        ver: Version;
        dependencies: Map<string, Dependency>;
      }
    ) => string;
  }): Promise<Record<string, string>> {
    const results = await this.resolveVersion(resolveFn);
    if (results.some((res) => res.type === "ERROR")) {
      const errors = results.filter((res): res is ErrorVersion => res.type === "ERROR");
      throw new Error(
        `Failed to resolve versions:\n${errors.map((e) => `- ${e.value} for ${e.prev.type} version ${e.prev} (error: ${e.error.message})`).join("\n")}`
      );
    }

    const importMap: Record<string, string> = {};
    for (const dep of this.#byDeps.values()) {
      for (const { pkg, version } of dep.pkgs.values()) {
        importMap[pkg.givenPkg] = renderRHS(pkg, version);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return toSortedObject(importMap)!;
  }

  getByPkg(pkg: string): Dependency | undefined {
    return this.#byDeps.get(pkg);
  }

  *byPkg() {
    for (const dep of this.#byDeps.values()) {
      yield dep;
    }
  }
  *byGroups() {
    for (const [grp, groupMap] of this.#byGroups.entries()) {
      for (const dep of groupMap.values()) {
        yield { grp, dep };
      }
    }
  }
}

interface RenderEsmShOpts {
  baseUrl?: string; // default to "https://esm.sh/"
  privateUrl?: string; // default to "https://registry.npmjs.org/"
}
export function render_esm_sh(opts: RenderEsmShOpts = {}) {
  return (pkg: NPMPackage, version: { ver: Version; dependencies: Map<string, Dependency> }) => {
    const buildURI = BuildURI.from(opts.baseUrl || "https://esm.sh/");

    let versionStr = pkg.pkg;
    switch (version.ver.version.type) {
      case "RESOLVED":
      case "SYMBOLIC":
      case "SEMVER":
        versionStr += `@${version.ver.version.value}`;
        break;
      default:
        if (version.ver.privateNpm) {
          return BuildURI.from(opts.privateUrl ?? opts.baseUrl ?? "https://esm.sh/")
            .appendRelative(pkg.givenPkg)
            .toString();
        }
        break;
    }
    buildURI.appendRelative(versionStr);

    if (pkg.suffix) {
      buildURI.appendRelative(pkg.suffix);
    }
    if (version.dependencies.size > 0) {
      buildURI.setParam(
        "deps",
        Array.from(version.dependencies.entries())
          .map(([pkg, dep]) => {
            const my = dep.pkgs.get(pkg);
            if (!my) {
              throw new Error(`Cannot render dependency with no pkgs`);
            }
            if (my.version.ver.version.type === "ERROR" || my.version.ver.version.type === "NONE") {
              throw new Error(`Cannot render dependency with unresolved version: ${JSON.stringify(my.version.ver.version)}`);
            }
            return `${pkg}@${my.version.ver.version.value}`;
          })
          .join(",")
      );
    }
    return buildURI.toString();
  };
}

// fetchPkgVersion: (pkg: string) => Promise<string | undefined>

export function resolveVersionRegistry({
  symbol2Version,
  fetch = defaultFetchPkgVersion(),
}: {
  symbol2Version?: Record<string, string>;
  fetch?: (pkg: string, semVersion?: string) => Promise<Result<{ src: string; version: string }>>;
}): (pkg: { pkg: NPMPackage; version: { ver: Version } }) => Promise<Result<{ src: string; version: string }>> {
  return async ({ pkg, version }) => {
    if (version.ver.version.type === "SYMBOLIC") {
      const sym = version.ver.version.value;
      if (symbol2Version && symbol2Version[sym]) {
        return Result.Ok({ src: `symbol2Version:${sym}`, version: symbol2Version[sym] });
      }
      return fetch(pkg.pkg, sym);
    }
    return Result.Err(`Cannot resolve version for ${pkg.pkg} with version type ${version.ver.version.type}`);
  };
}
// interface Dependencies {
//   [dependencyName: string]: Version;
// }

// interface Grouped {
//   [groupName: string]: Dependencies;
// }
