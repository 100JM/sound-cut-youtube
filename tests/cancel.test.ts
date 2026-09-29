import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync } from "node:fs";
import { POST, DELETE, PUT } from "../src/app/api/extract/route";

test("update reservation requires desktop authentication and blocks new extraction", async () => {
  const previous = process.env.SOUNDCUT_DESKTOP_TOKEN;
  process.env.SOUNDCUT_DESKTOP_TOKEN = "test-only-token";
  const control = (action: string) => new Request("http://localhost/api/extract", { method: "PUT", headers: { authorization: "Bearer test-only-token", "x-update-action": action } });
  try {
    assert.equal((await PUT(new Request("http://localhost/api/extract", { method: "PUT" }))).status, 403);
    assert.equal((await PUT(control("reserve"))).status, 200);
    const pending = new Request("http://localhost/api/extract", { method: "POST", body: JSON.stringify({ url: "https://youtu.be/aqz-KE-bpKQ", start: "0", end: "1" }) });
    assert.equal((await POST(pending)).status, 503);
  } finally {
    await PUT(control("release"));
    if (previous === undefined) delete process.env.SOUNDCUT_DESKTOP_TOKEN;
    else process.env.SOUNDCUT_DESKTOP_TOKEN = previous;
  }
});

test("cancel acknowledges cleanup and immediately allows a new extraction", { timeout: 15000, skip: process.platform !== "win32" || !existsSync(".tools/ffmpeg.exe") }, async () => {
  const previous = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = path.resolve(".tools/ffmpeg.exe");
  try {
    for (const id of ["first", "second"]) {
      const request = new Request("http://localhost/api/extract", { method: "POST", headers: { "x-job-id": id }, body: JSON.stringify({ url: "https://youtu.be/aqz-KE-bpKQ", start: "0", end: "1" }) });
      const pending = POST(request);
      let response: Response | undefined;
      for (let i = 0; i < 100; i++) {
        response = await DELETE(new Request("http://localhost/api/extract", { method: "DELETE", headers: { "x-job-id": id } }));
        if (response.status === 200) break;
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      assert.equal(response?.status, 200);
      assert.equal((await pending).status, 499);
    }
  } finally {
    if (previous === undefined) delete process.env.FFMPEG_PATH;
    else process.env.FFMPEG_PATH = previous;
  }
});
