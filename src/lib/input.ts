export function youtubeUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("올바른 유튜브 주소를 입력해 주세요."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) throw new Error("올바른 유튜브 주소를 입력해 주세요.");
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname)?.[1] ?? null;
  }
  if (!id || !/^[\w-]{11}$/.test(id)) throw new Error("유효한 유튜브 영상 주소를 입력해 주세요.");
  return `https://www.youtube.com/watch?v=${id}`;
}

export function seconds(input: string): number {
  const value = input.trim();
  if (!/^\d+(?::[0-5]\d){0,2}(?:\.\d{1,3})?$/.test(value)) throw new Error("시간은 초, 분:초 또는 시:분:초 형식으로 입력해 주세요.");
  const total = value.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
  if (!Number.isFinite(total) || total > 86400) throw new Error("시간은 24시간 이내로 입력해 주세요.");
  return total;
}

export function parseInput(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("입력값을 확인해 주세요.");
  const { url, start, end } = body as Record<string, unknown>;
  if (typeof url !== "string" || typeof start !== "string" || typeof end !== "string") throw new Error("주소와 시작·종료 시간을 입력해 주세요.");
  const canonical = youtubeUrl(url);
  const from = seconds(start), to = seconds(end);
  if (to <= from) throw new Error("종료 시간은 시작 시간보다 늦어야 합니다.");
  if (to - from > 1800) throw new Error("한 번에 최대 30분까지 추출할 수 있습니다.");
  return { url: canonical, start: from, end: to };
}
