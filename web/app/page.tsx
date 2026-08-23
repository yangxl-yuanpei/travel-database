import type { Metadata } from "next";
import { MapExplorer } from "./components/MapExplorer";

export const metadata: Metadata = {
  title: "赣行志 · 2026 国庆江西协同旅行地图",
  description: "从珠海、北京与上海出发，在南昌会合，继续前往景德镇与上饶的结构化旅行地图。",
};

export default function Home() {
  return <MapExplorer />;
}
