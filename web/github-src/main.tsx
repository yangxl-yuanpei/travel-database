import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MapExplorer } from "../app/components/MapExplorer";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MapExplorer />
  </StrictMode>,
);
