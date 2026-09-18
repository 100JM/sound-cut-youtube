import test from "node:test";
import assert from "node:assert/strict";
import { parseInput, seconds, youtubeUrl } from "../src/lib/input";
test("normalizes video URLs and removes playlist arguments", () => {
  assert.equal(youtubeUrl("https://youtu.be/dQw4w9WgXcQ?t=20"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(youtubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});
test("rejects arbitrary hosts and malformed IDs", () => {
  for (const url of ["http://127.0.0.1/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "file:///etc/passwd", "https://youtube.com/watch?v=foo"]) assert.throws(() => youtubeUrl(url));
});
test("parses times precisely", () => { assert.equal(seconds("01:02:03.5"), 3723.5); assert.equal(seconds("90"), 90); assert.throws(() => seconds("1:60")); assert.throws(() => seconds("-1")); });
test("rejects backwards and oversized clips", () => {
  const url = "https://youtu.be/dQw4w9WgXcQ";
  assert.throws(() => parseInput({ url, start: "30", end: "10" }));
  assert.throws(() => parseInput({ url, start: "0", end: "1801" }));
  assert.deepEqual(parseInput({ url, start: "1:00", end: "1:30" }), { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", start: 60, end: 90 });
});
