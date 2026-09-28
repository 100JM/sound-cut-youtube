import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../src/lib/origin";

test("desktop accepts its exact origin despite Next loopback normalization", () => {
  const request = new Request("http://localhost:43210/api/extract", { headers: { Origin: "http://127.0.0.1:43210" } });
  assert.equal(isAllowedOrigin(request, "http://127.0.0.1:43210"), true);
});
test("desktop rejects external sites, different ports and null origins", () => {
  for (const origin of ["https://untrusted.example", "http://127.0.0.1:43211", "null", "http://localhost:43210"]) {
    const request = new Request("http://localhost:43210/api/extract", { headers: { Origin: origin } });
    assert.equal(isAllowedOrigin(request, "http://127.0.0.1:43210"), false);
  }
});
test("web mode retains same-origin checks and permits non-browser requests", () => {
  assert.equal(isAllowedOrigin(new Request("https://soundcut.example/api/extract", { headers: { Origin: "https://soundcut.example" } })), true);
  assert.equal(isAllowedOrigin(new Request("https://soundcut.example/api/extract", { headers: { Origin: "https://untrusted.example" } })), false);
  assert.equal(isAllowedOrigin(new Request("https://soundcut.example/api/extract")), true);
});
