/**
 * A fetch replacement that falls back to XMLHttpRequest when the page is loaded
 * over the file:// protocol. Chromium-family browsers block fetch() against
 * file:// origins (CORS-style protection against local-file exfiltration), but
 * XMLHttpRequest is still allowed for same-directory reads. The XHR response
 * is wrapped in a standard Response so callers stay agnostic.
 */
export async function fetchSafe(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  if (
    isFileProtocol() &&
    (!init || (init.method ?? "GET").toUpperCase() === "GET")
  ) {
    return fetchViaXhr(input);
  }
  return fetch(input, init);
}

function isFileProtocol(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.location !== "undefined" &&
    window.location.protocol === "file:"
  );
}

function fetchViaXhr(url: string): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = () => {
      // For file:// reads, the spec leaves xhr.status at 0 on success — treat
      // that as 200. Anything else (a real HTTP response) is passed through.
      const status = xhr.status === 0 ? 200 : xhr.status;
      const body = xhr.response as ArrayBuffer | null;
      resolve(
        new Response(body ?? new ArrayBuffer(0), {
          status,
          statusText: xhr.statusText || "OK",
        }),
      );
    };
    xhr.onerror = () =>
      reject(new TypeError(`fetchSafe: XHR failed for ${url}`));
    xhr.ontimeout = () =>
      reject(new TypeError(`fetchSafe: XHR timed out for ${url}`));
    try {
      xhr.send();
    } catch (err) {
      reject(err instanceof Error ? err : new TypeError(String(err)));
    }
  });
}
