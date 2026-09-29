"use client";
import { useEffect, useRef, useState } from "react";
import { parseInput, seconds, youtubeUrl } from "@/lib/input";
import VideoEditor, { formatTime } from "@/components/video-editor";
import UpdateButton from "@/components/update-button";


export default function Home() {
  const [year, setYear] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [start, setStart] = useState("00:00");
  const [end, setEnd] = useState("00:30");
  const [videoLength, setVideoLength] = useState(0);
  function changeStart(value: string) {
    setStart(value);
    try {
      const from = seconds(value);
      if (from >= seconds(end)) {
        const limit = videoLength > 0 ? Math.floor(videoLength * 10) / 10 : 86400;
        if (from < limit) setEnd(formatTime(Math.min(from + 30, limit)));
      }
    } catch { /* Preserve incomplete input for the existing validation. */ }
  }
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const jobId = useRef("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ href: string; name: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  let videoId = "";
  try { videoId = new URL(youtubeUrl(url)).searchParams.get("v") || ""; } catch {}
  useEffect(() => { setYear(new Date().getFullYear()); }, []);
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.href); }, [result]);
  let duration = 0;
  try { duration = Math.max(0, seconds(end) - seconds(start)); } catch {}
  async function extract(event: React.FormEvent) {
    event.preventDefault(); setError("");
    try { parseInput({ url, start, end }); } catch (error) { setError((error as Error).message); return; }
    setBusy(true); setResult(null); controller.current = new AbortController();
    jobId.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json", "x-job-id": jobId.current }, body: JSON.stringify({ url, start, end }), signal: controller.current.signal });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || "추출에 실패했습니다."); }
      const blob = await response.blob();
      const encoded = response.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''(.+)$/)?.[1];
      setResult({ href: URL.createObjectURL(blob), name: encoded ? decodeURIComponent(encoded) : "clip.mp3" });
    } catch (error) { setError((error as Error).name === "AbortError" ? "추출을 취소했습니다." : (error as Error).message); }
    finally { controller.current = null; setBusy(false); }
  }
  async function cancelExtraction() {
    if (cancelling) return;
    setCancelling(true);
    const pending = controller.current;
    try {
      for (let attempt = 0; attempt < 30 && pending && controller.current === pending; attempt++) {
        const response = await fetch("/api/extract", { method: "DELETE", headers: { "x-job-id": jobId.current } });
        if (response.ok) return;
        if (response.status !== 404) throw new Error("취소 요청에 실패했습니다. 다시 취소해 주세요.");
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (pending && controller.current === pending) throw new Error("취소 요청을 확인하지 못했습니다. 다시 취소해 주세요.");
    } catch (error) { setError((error as Error).message); }
    finally { setCancelling(false); }
  }
  return <div className="shell">
    <header><a className="brand" href="/" aria-label="Soundcut 홈"><span className="brand-icon">♫</span> soundcut<span className="brand-dot">.</span></a><span className="header-note">작은 순간, 나만의 사운드</span><span className="version">BETA 1.1</span></header>
    <UpdateButton busy={busy || cancelling} />
    <main>
      <div className="eyebrow"><span /> YOUTUBE TO MP3</div>
      <h1>듣고 싶은 순간만,<br /><em>가볍게 잘라내세요.</em></h1>
      <p className="intro">유튜브 링크를 붙여넣고 원하는 구간을 선택하세요.<br />그 순간의 소리를 MP3 파일로 간직할 수 있어요.</p>
      <section className="workspace">
        <form onSubmit={extract}>
          <div className="section-title"><span className="step">01</span><h2>어떤 영상인가요?</h2><span className="tag">영상 링크</span></div>
          <label className="sr-only" htmlFor="url">유튜브 영상 주소</label>
          <div className="url-wrap"><span aria-hidden="true">↗</span><input id="url" type="url" placeholder="유튜브 영상 주소를 붙여넣어 주세요" required value={url} onChange={e => { setUrl(e.target.value); setVideoLength(0); setStart("00:00"); setEnd("00:30"); setResult(null); setError(""); }} disabled={busy} /></div>
          <p className="hint">youtube.com · youtu.be · Shorts 링크를 지원해요</p>
          {videoId && <VideoEditor key={videoId} videoId={videoId} start={start} end={end} onStart={changeStart} onEnd={setEnd} onDuration={setVideoLength} disabled={busy} />}
          <div className="divider" />
          <div className="section-title"><span className="step">02</span><h2>어느 순간을 담을까요?</h2><span className="tag">구간 선택</span></div>
          <div className="times"><label htmlFor="start">시작 시간<input id="start" type="text" value={start} onChange={e => setStart(e.target.value)} onBlur={e => changeStart(e.target.value)} disabled={busy} required /></label><span className="time-arrow">→</span><label htmlFor="end">종료 시간<input id="end" type="text" value={end} onChange={e => setEnd(e.target.value)} disabled={busy} required /></label></div>
          <div className="range-info"><span>분:초 또는 시:분:초로 입력</span><strong>선택 구간 <b>{duration ? `${Number(duration.toFixed(3))}초` : "—"}</b></strong></div>
          <div className="divider" />
          <div className="format"><span className="file-icon">♪</span><div><strong>MP3 오디오</strong><small>어디서든 재생하기 편한 포맷</small></div><span className="quality">192 kbps</span></div>
          <button className="primary" type="submit" disabled={busy || cancelling}>{busy ? <><span className="spinner" /> 오디오를 추출하고 있어요…</> : <>오디오 추출하기 <span>↓</span></>}</button>
          {busy && <div className="processing" role="status">영상에 따라 몇 분 정도 걸릴 수 있어요. <button type="button" disabled={cancelling} onClick={cancelExtraction}>{cancelling ? "작업을 종료하는 중…" : "취소"}</button></div>}
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
