import { describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "../apiClient";

describe("apiFetch", () => {
  it("adds alliance header and JSON encodes body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    await apiFetch("/api/test", {
      method: "POST",
      allianceId: "art",
      body: { hello: "world" }
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const args = fetchSpy.mock.calls[0];
    expect(args[0]).toBe("/api/test");
    const options = args[1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      "x-alliance-id": "art",
      "Content-Type": "application/json"
    });
    expect(options.body).toBe(JSON.stringify({ hello: "world" }));
  });

  it("throws ApiError on non-ok response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Bad" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(apiFetch("/api/test")).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch("/api/test")).rejects.toMatchObject({
      status: 400
    });
  });

  it("returns non-ok payload when allowNonOk is true", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Bad" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await apiFetch("/api/test", { allowNonOk: true });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({ error: "Bad" });
  });
});
