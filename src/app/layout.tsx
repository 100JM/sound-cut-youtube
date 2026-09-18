import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Soundcut — 유튜브 오디오 추출", description: "마음에 드는 순간을 MP3로. 유튜브 영상에서 원하는 구간의 오디오를 추출하세요." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
