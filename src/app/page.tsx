"use client";
import { useEffect, useRef, useState } from "react";
import { parseInput, seconds } from "@/lib/input";

// Fixed integer heights keep server and browser style attributes identical.
const WAVE_HEIGHTS = [12, 45, 30, 24, 38, 15, 20, 36, 43, 28, 17, 46, 32, 22, 39, 14];

export default function Home() {
  const [year, setYear] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [start, setStart] = useState("00:00");
  const [end, setEnd] = useState("00:30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ href: string; name: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { setYear(new Date().getFullYear()); }, []);
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.href); }, [result]);
  let duration = 0;
  try { duration = Math.max(0, seconds(end) - seconds(start)); } catch {}
  async function extract(event: React.FormEvent) {
    event.preventDefault(); setError("");
    try { parseInput({ url, start, end }); } catch (error) { setError((error as Error).message); return; }
    setBusy(true); setResult(null); controller.current = new AbortController();
    try {
      const response = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, start, end }), signal: controller.current.signal });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || "추출에 실패했습니다."); }
      const blob = await response.blob();
      const encoded = response.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''(.+)$/)?.[1];
      setResult({ href: URL.createObjectURL(blob), name: encoded ? decodeURIComponent(encoded) : "clip.mp3" });
    } catch (error) { setError((error as Error).name === "AbortError" ? "추출을 취소했습니다." : (error as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="shell">
    <header><a className="brand" href="/" aria-label="Soundcut 홈"><span className="brand-icon">♫</span> soundcut<span className="brand-dot">.</span></a><span className="header-note">작은 순간, 나만의 사운드</span><span className="version">BETA 1.0</span></header>
    <main>
      <div className="eyebrow"><span /> YOUTUBE TO MP3</div>
      <h1>듣고 싶은 순간만,<br /><em>가볍게 잘라내세요.</em></h1>
      <p className="intro">유튜브 링크를 붙여넣고 원하는 구간을 선택하세요.<br />그 순간의 소리를 MP3 파일로 간직할 수 있어요.</p>
      <section className="workspace">
        <form onSubmit={extract}>
          <div className="section-title"><span className="step">01</span><h2>어떤 영상인가요?</h2><span className="tag">영상 링크</span></div>
          <label className="sr-only" htmlFor="url">유튜브 영상 주소</label>
          <div className="url-wrap"><span aria-hidden="true">↗</span><input id="url" type="url" placeholder="유튜브 영상 주소를 붙여넣어 주세요" required value={url} onChange={e => setUrl(e.target.value)} disabled={busy} /></div>
          <p className="hint">youtube.com · youtu.be · Shorts 링크를 지원해요</p>
          <div className="divider" />
          <div className="section-title"><span className="step">02</span><h2>어느 순간을 담을까요?</h2><span className="tag">구간 선택</span></div>
          <div className="times"><label htmlFor="start">시작 시간<input id="start" type="text" value={start} onChange={e => setStart(e.target.value)} disabled={busy} required /></label><span className="time-arrow">→</span><label htmlFor="end">종료 시간<input id="end" type="text" value={end} onChange={e => setEnd(e.target.value)} disabled={busy} required /></label></div>
          <div className="range-info"><span>분:초 또는 시:분:초로 입력</span><strong>선택 구간 <b>{duration ? `${Number(duration.toFixed(3))}초` : "—"}</b></strong></div>
          <div className="wave" aria-hidden="true">{Array.from({ length: 65 }, (_, i) => <i key={i} style={{ height: `${WAVE_HEIGHTS[i % WAVE_HEIGHTS.length]}px` }} />)}<span className="wave-dot left" /><span className="wave-dot right" /></div>
          <div className="format"><span className="file-icon">♪</span><div><strong>MP3 오디오</strong><small>어디서든 재생하기 편한 포맷</small></div><span className="quality">192 kbps</span></div>
          <button className="primary" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> 오디오를 추출하고 있어요…</> : <>오디오 추출하기 <span>↓</span></>}</button>
          {busy && <div className="processing" role="status">영상에 따라 몇 분 정도 걸릴 수 있어요. <button type="button" onClick={() => controller.current?.abort()}>취소</button></div>}
          {error && <p className="error" role="alert">{error}</p>}
          {result && <div className="result" role="status"><strong>오디오가 준비되었어요!</strong><audio controls src={result.href} /><a href={result.href} download={result.name}>MP3 다운로드 ↓</a></div>}
        </form>
      </section>
      <div className="benefits"><span>✓ 설치 없는 간편한 사용</span><span>✓ 최대 30분 구간 추출</span><span>✓ 변환 후 서버 파일 삭제</span></div>
      <p className="rights">직접 제작했거나 다운로드 권한이 있는 영상에 사용해 주세요.</p>
    </main>
    <footer><span>© {year} Soundcut</span><span>좋아하는 소리를, 더 가까이.</span></footer>
  </div>;
}
