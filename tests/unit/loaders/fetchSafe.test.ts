import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSafe } from "@/loaders/fetchSafe";

const originalFetch = global.fetch;
const originalLocation = window.location;

afterEach(() => {
  global.fetch = originalFetch;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
});

function setProtocol(protocol: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, protocol },
  });
}

describe("fetchSafe", () => {
  it("delegates to fetch on http:// origins", async () => {
    setProtocol("http:");
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await fetchSafe("/foo");
    expect(spy).toHaveBeenCalledWith("/foo", undefined);
    expect(res.status).toBe(200);
  });

  it("delegates to fetch on https:// origins", async () => {
    setProtocol("https:");
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    await fetchSafe("/foo");
    expect(spy).toHaveBeenCalled();
  });

  it("delegates to fetch on file:// when method is not GET", async () => {
    setProtocol("file:");
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    await fetchSafe("/foo", { method: "POST", body: "x" });
    expect(spy).toHaveBeenCalled();
  });

  it("uses XHR fallback on file:// for GET", async () => {
    setProtocol("file:");
    const spy = vi.spyOn(globalThis, "fetch");

    const xhrMock = {
      open: vi.fn(),
      send: vi.fn(),
      responseType: "" as XMLHttpRequestResponseType,
      status: 0,
      statusText: "",
      response: new TextEncoder().encode('{"ok":true}').buffer,
      onload: null as null | (() => void),
      onerror: null as null | (() => void),
      ontimeout: null as null | (() => void),
    };
    vi.stubGlobal(
      "XMLHttpRequest",
      vi.fn(() => xhrMock),
    );

    const promise = fetchSafe("file:///game/manifest.json");
    xhrMock.onload?.();
    const res = await promise;

    expect(spy).not.toHaveBeenCalled();
    expect(xhrMock.open).toHaveBeenCalledWith(
      "GET",
      "file:///game/manifest.json",
      true,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("rejects when XHR errors", async () => {
    setProtocol("file:");
    const xhrMock = {
      open: vi.fn(),
      send: vi.fn(),
      responseType: "" as XMLHttpRequestResponseType,
      status: 0,
      response: null,
      onload: null as null | (() => void),
      onerror: null as null | (() => void),
      ontimeout: null as null | (() => void),
    };
    vi.stubGlobal(
      "XMLHttpRequest",
      vi.fn(() => xhrMock),
    );
    const promise = fetchSafe("file:///missing.json");
    xhrMock.onerror?.();
    await expect(promise).rejects.toBeInstanceOf(TypeError);
  });
});
