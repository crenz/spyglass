import { describe, it, expect, vi } from "vitest";
import { loadBundledGame } from "@/loaders/bundled";
import { GameLoadError } from "@/loaders/types";

const validManifest = {
  id: "hello",
  version: 1,
  title: "Hello",
  startScene: "title",
  scenes: [
    {
      id: "title",
      kind: "splash",
      image: "images/title.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: "intro" },
    },
    {
      id: "intro",
      kind: "splash",
      image: "images/intro.png",
      advance: { kind: "key" },
      onAdvance: { gotoSceneId: null },
    },
  ],
};

function makeFetch(
  handler: (url: string) => Response | Promise<Response>,
): typeof fetch {
  return ((url: string) =>
    Promise.resolve(handler(String(url)))) as typeof fetch;
}

describe("loadBundledGame", () => {
  it("fetches, validates, and returns a LoadedGame", async () => {
    const fetchImpl = makeFetch((url) => {
      expect(url).toBe("./games/hello/manifest.json");
      return new Response(JSON.stringify(validManifest), { status: 200 });
    });
    const loaded = await loadBundledGame("hello", { fetchImpl });
    expect(loaded.game.id).toBe("hello");
    expect(loaded.game.scenes).toHaveLength(2);
    expect(loaded.bundleBaseUrl).toBe("./games/hello/");
  });

  it("resolves asset URLs relative to the bundle", async () => {
    const fetchImpl = makeFetch(
      () => new Response(JSON.stringify(validManifest), { status: 200 }),
    );
    const loaded = await loadBundledGame("hello", { fetchImpl });
    expect(loaded.resolveAssetUrl("images/title.png")).toBe(
      "./games/hello/images/title.png",
    );
  });

  it("honors a custom baseUrl (e.g., GitHub Pages subpath)", async () => {
    const fetchImpl = makeFetch((url) => {
      expect(url).toBe("/spyglass/games/hello/manifest.json");
      return new Response(JSON.stringify(validManifest), { status: 200 });
    });
    const loaded = await loadBundledGame("hello", {
      fetchImpl,
      baseUrl: "/spyglass",
    });
    expect(loaded.bundleBaseUrl).toBe("/spyglass/games/hello/");
  });

  it("rejects when fetch returns non-OK", async () => {
    const fetchImpl = makeFetch(
      () => new Response("not found", { status: 404 }),
    );
    await expect(
      loadBundledGame("missing", { fetchImpl }),
    ).rejects.toBeInstanceOf(GameLoadError);
  });

  it("rejects when the response is not JSON", async () => {
    const fetchImpl = makeFetch(
      () => new Response("this is not json", { status: 200 }),
    );
    await expect(
      loadBundledGame("hello", { fetchImpl }),
    ).rejects.toBeInstanceOf(GameLoadError);
  });

  it("rejects a manifest that fails schema validation", async () => {
    const fetchImpl = makeFetch(
      () =>
        new Response(JSON.stringify({ ...validManifest, scenes: [] }), {
          status: 200,
        }),
    );
    await expect(
      loadBundledGame("hello", { fetchImpl }),
    ).rejects.toBeInstanceOf(GameLoadError);
  });

  it("refuses to resolve asset paths that escape the bundle", async () => {
    const fetchImpl = makeFetch(
      () => new Response(JSON.stringify(validManifest), { status: 200 }),
    );
    const loaded = await loadBundledGame("hello", { fetchImpl });
    expect(() => loaded.resolveAssetUrl("../escape.png")).toThrow(
      GameLoadError,
    );
    expect(() => loaded.resolveAssetUrl("/etc/passwd")).toThrow(GameLoadError);
    expect(() => loaded.resolveAssetUrl("http://evil.example/x.png")).toThrow(
      GameLoadError,
    );
  });

  it("wraps network errors in GameLoadError", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(
        new TypeError("Failed to fetch"),
      ) as unknown as typeof fetch;
    await expect(
      loadBundledGame("hello", { fetchImpl }),
    ).rejects.toBeInstanceOf(GameLoadError);
  });
});
