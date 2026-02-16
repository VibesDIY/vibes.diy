import { describe, expect, it, vi } from "vitest";
import {
  Version,
  Package,
  Dependencies,
  Dependency,
  render_esm_sh,
  resolveVersionRegistry,
  defaultFetchPkgVersion,
} from "@vibes.diy/api-svc";
import { Result } from "@adviser/cement";

describe("Version.parse", () => {
  it("defaults to SYMBOLIC LATEST when version value is empty", () => {
    const v = Version.parse("version:");
    expect(v.version).toEqual({ type: "SYMBOLIC", value: "LATEST" });
    expect(v.privateNpm).toBe(false);
    expect(v.deps).toEqual([]);
  });

  it("parses explicit semver version", () => {
    const v = Version.parse("version:1.2.3");
    expect(v.version).toEqual({ type: "SEMVER", value: "1.2.3" });
    expect(v.givenVersion).toBe("version:1.2.3");
  });

  it("parses version with prerelease tag as SEMVER", () => {
    const v = Version.parse("version:0.12.6-dev");
    expect(v.version).toEqual({ type: "SEMVER", value: "0.12.6-dev" });
  });

  it("parses non-semver version as SYMBOLIC", () => {
    const v = Version.parse("version:FP");
    expect(v.version).toEqual({ type: "SYMBOLIC", value: "FP" });
  });

  it("defaults to NONE with no version key at all", () => {
    const v = Version.parse("deps:react");
    expect(v.version).toEqual({ type: "NONE" });
    expect(v.deps).toEqual(["react"]);
  });

  it("parses single dependency", () => {
    const v = Version.parse("version:1.0.0,deps:react");
    expect(v.deps).toEqual(["react"]);
  });

  it("parses multiple dependencies", () => {
    const v = Version.parse("version:1.0.0,deps:react,deps:react-dom");
    expect(v.deps).toEqual(["react", "react-dom"]);
  });

  it("parses multiple dependencies", () => {
    const v = Version.parse("version:1.0.0,deps:react,react-dom");
    expect(v.deps).toEqual(["react", "react-dom"]);
  });

  it("throws when combining version: and privateNpm:", () => {
    expect(() => Version.parse("version:1.0.0,privateNpm:")).toThrow("Cannot combine version: and privateNpm:");
  });

  it("parses combo of version and deps", () => {
    const v = Version.parse("version:2.0.0,deps:react,deps:react-dom");
    expect(v.version).toEqual({ type: "SEMVER", value: "2.0.0" });
    expect(v.deps).toEqual(["react", "react-dom"]);
    expect(v.privateNpm).toBe(false);
  });

  it("parses privateNpm with deps but no explicit version", () => {
    const v = Version.parse("privateNpm:,deps:react");
    expect(v.privateNpm).toBe(true);
    expect(v.version).toEqual({ type: "NONE" });
    expect(v.deps).toEqual(["react"]);
  });

  it("throws when combining version: and privateNpm: with whitespace", () => {
    expect(() => Version.parse(" version:1.0.0 , deps:react , privateNpm: ")).toThrow("Cannot combine version: and privateNpm:");
  });

  it("preserves givenVersion", () => {
    const input = "version:3.0.0,deps:lodash";
    const v = Version.parse(input);
    expect(v.givenVersion).toBe(input);
  });

  it("ignores bare non-semver tokens", () => {
    const v = Version.parse("notaversion");
    expect(v.version).toEqual({ type: "NONE" });
  });

  it("throws on empty version string", () => {
    expect(() => Version.parse("")).not.toThrow(); // Should not throw, should just return NONE
  });

  it("detects bare semver token without version: prefix", () => {
    const v = Version.parse("1.2.3");
    expect(v.version).toEqual({ type: "SEMVER", value: "1.2.3" });
  });
});

describe("Package.parse", () => {
  it("parses simple package name", () => {
    const p = Package.parse("react");
    expect(p.pkg).toBe("react");
    expect(p.suffix).toBeUndefined();
    expect(p.givenPkg).toBe("react");
  });

  it("parses package with subpath", () => {
    const p = Package.parse("react/jsx-runtime");
    expect(p.pkg).toBe("react");
    expect(p.suffix).toBe("/jsx-runtime");
    expect(p.givenPkg).toBe("react/jsx-runtime");
  });

  it("parses scoped package", () => {
    const p = Package.parse("@scope/package");
    expect(p.pkg).toBe("@scope/package");
    expect(p.suffix).toBeUndefined();
  });

  it("parses scoped package with subpath", () => {
    const p = Package.parse("@scope/package/dist/index");
    expect(p.pkg).toBe("@scope/package");
    expect(p.suffix).toBe("/dist/index");
  });

  it("preserves givenPkg", () => {
    const input = "@vibes.diy/use-vibes-base/hooks";
    const p = Package.parse(input);
    expect(p.givenPkg).toBe(input);
    expect(p.pkg).toBe("@vibes.diy/use-vibes-base");
    expect(p.suffix).toBe("/hooks");
  });

  it("handles package with deep nested subpath", () => {
    const p = Package.parse("lodash/fp/get");
    expect(p.pkg).toBe("lodash");
    expect(p.suffix).toBe("/fp/get");
  });

  it("handles scoped package with no extra segments", () => {
    const p = Package.parse("@fireproof/core");
    expect(p.pkg).toBe("@fireproof/core");
    expect(p.suffix).toBeUndefined();
  });

  it("throws on invalid package string", () => {
    expect(() => Package.parse("")).toThrow("Invalid package string");
  });
});

describe("Test Dependencies", () => {
  it("add should manage doubles and suffix correctly", () => {
    const deps = new Dependencies();
    let reactDep: Dependency | undefined = undefined;
    for (let i = 0; i < 6; i++) {
      let group = undefined;
      if (i % 3 === 0) {
        group = `group${~~(i / 3)}`;
      }
      reactDep = deps.add("react/jsx-runtime", "version:17.0.0", group);
      deps.add("react", "version:17.0.0", group);
      deps.add("react/yolu", "version:17.0.0", group);
    }
    let cnt = 0;
    for (const x of deps.byPkg()) {
      cnt++;
      expect(x.pkg).toBe("react");
      expect(
        Array.from(x.pkgs.values())
          .map((i) => i.pkg.suffix)
          .sort()
      ).toEqual(["/jsx-runtime", "/yolu", undefined]);
      expect(x.groups).toEqual(new Set(["group0", "group1"]));
    }
    expect(cnt).toBe(1);

    const res = vi.fn();
    for (const x of deps.byGroups()) {
      res(x);
    }
    expect(res.mock.calls.map((i) => i[0].grp)).toEqual(["group0", "group1"]);
    expect(res.mock.calls.map((i) => i[0].dep)[0]).toBe(reactDep);
    expect(res.mock.calls.map((i) => i[0].dep)[1]).toBe(reactDep);
  });

  it("resolvesVersionDependency", async () => {
    const deps = new Dependencies();
    const myLib = deps.add("my-lib", "version:1.0.0");
    const react = deps.add("react", "version:17.0.0", "react");
    const reactDom = deps.add("react-dom", "version:17.0.0", "react");

    deps.add("@fp/use-1", "version:2.0.0,deps:my-lib", "fp");
    deps.add("@fp/use-2", "version:2.0.0,deps:react", "fp");
    deps.add("@fp/use-3", "version:2.0.0,deps:new-lib", "fp");
    deps.add("@fp/use-4", "version:2.0.0,deps:new-lib,my-lib,react", "fp");

    deps.resolveVersionDeps();
    const newLib = deps.getByPkg("new-lib");

    expect(Array.from(deps.getByPkg("@fp/use-1")?.pkgs.values().next().value?.version.dependencies.values() || [])).toEqual([
      myLib,
    ]);
    expect(Array.from(deps.getByPkg("@fp/use-2")?.pkgs.values().next().value?.version.dependencies.values() || [])).toEqual([
      react,
      reactDom,
    ]);
    expect(Array.from(deps.getByPkg("@fp/use-3")?.pkgs.values().next().value?.version.dependencies.values() || [])).toEqual([
      newLib,
    ]);
    expect(Array.from(deps.getByPkg("@fp/use-4")?.pkgs.values().next().value?.version.dependencies.values() || [])).toEqual([
      newLib,
      myLib,
      react,
      reactDom,
    ]);

    const resolvRes = await deps.resolveVersion((_pkg) => {
      return Promise.resolve(Result.Ok({ src: "registry", version: "8.0.0" }));
    });

    expect(resolvRes).toEqual([
      {
        prev: {
          type: "SYMBOLIC",
          value: "LATEST",
        },
        result: {
          src: "registry",
          version: "8.0.0",
        },
        type: "RESOLVED",
        value: "8.0.0",
      },
    ]);

    expect(Array.from(deps.getByPkg("new-lib")?.pkgs.values() || []).map((i) => i.version.ver.version)).toEqual([
      {
        prev: {
          type: "SYMBOLIC",
          value: "LATEST",
        },
        result: {
          src: "registry",
          version: "8.0.0",
        },
        type: "RESOLVED",
        value: "8.0.0",
      },
    ]);
  });

  it("dependenciesFrom", async () => {
    const deps = Dependencies.from({
      "my-lib-1": "1.0.0",
      "my-lib-1/x1": "1.0.0",
      "my-lib-2": "version:",
      "my-lib-3": "version:3.0.0",
      react: {
        react: "version:REACT",
        "react-dom": "version:REACT",
      },
      "react/jsx-runtime": "version:REACT",
      "react/jsx-runtime-1": "version:REACT",
      fp: {
        "@fp/use-1": "version:2.0.0,deps:my-lib-1",
        "@fp/use-1/7979": "version:2.0.0,deps:react",
        "@fp/use-1/9999": "version:2.0.0",
        "@fp/use-2": "version:FP,deps:react",
        "@fp/use-3": "version:FP,deps:new-lib",
        "@fp/use-4": "version:FP,deps:new-lib,my-lib-1,react",
      },
      "@vibes.diy/base": "privateNpm:",
      "@vibes.diy/vibe-runtime": "privateNpm:",
    });

    const im = await deps.renderImportMap({
      resolveFn: resolveVersionRegistry({
        fetch: defaultFetchPkgVersion({
          defaults: {
            fetch: () => {
              return Promise.resolve(new Response(JSON.stringify({ version: "8.0.0" })));
            },
          },
        }),
        symbol2Version: {
          REACT: "11.0.0",
          FP: "2.0.0",
        },
      }),
      renderRHS: render_esm_sh({
        privateUrl: "http://localhost:8888/vibe-pkg/",
      }),
    });
    expect(im).toEqual({
      "@fp/use-1": "https://esm.sh/@fp/use-1@2.0.0?deps=my-lib-1%401.0.0",
      "@fp/use-1/7979": "https://esm.sh/@fp/use-1@2.0.0/7979?deps=react%4011.0.0%2Creact-dom%4011.0.0",
      "@fp/use-1/9999": "https://esm.sh/@fp/use-1@2.0.0/9999",
      "@fp/use-2": "https://esm.sh/@fp/use-2@2.0.0?deps=react%4011.0.0%2Creact-dom%4011.0.0",
      "@fp/use-3": "https://esm.sh/@fp/use-3@2.0.0?deps=new-lib%408.0.0",
      "@fp/use-4": "https://esm.sh/@fp/use-4@2.0.0?deps=new-lib%408.0.0%2Cmy-lib-1%401.0.0%2Creact%4011.0.0%2Creact-dom%4011.0.0",
      "@vibes.diy/base": "http://localhost:8888/vibe-pkg/@vibes.diy/base",
      "@vibes.diy/vibe-runtime": "http://localhost:8888/vibe-pkg/@vibes.diy/vibe-runtime",
      "my-lib-1": "https://esm.sh/my-lib-1@1.0.0",
      "my-lib-1/x1": "https://esm.sh/my-lib-1@1.0.0/x1",
      "my-lib-2": "https://esm.sh/my-lib-2@8.0.0",
      "my-lib-3": "https://esm.sh/my-lib-3@3.0.0",
      "new-lib": "https://esm.sh/new-lib@8.0.0",
      react: "https://esm.sh/react@11.0.0",
      "react-dom": "https://esm.sh/react-dom@11.0.0",
      "react/jsx-runtime": "https://esm.sh/react@11.0.0/jsx-runtime",
      "react/jsx-runtime-1": "https://esm.sh/react@11.0.0/jsx-runtime-1",
    });
  });
});
