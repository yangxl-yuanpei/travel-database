import type { Metadata } from "next";
import { MapExplorer } from "./components/MapExplorer";

export const metadata: Metadata = {
  title: "南昌 · 三处文化坐标",
  description: "从真实空间关系出发，浏览滕王阁、江西省博物馆与南昌八一起义纪念馆。",
};

export default function Home() {
  return <MapExplorer />;
}
