"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PlannerNode = {
  id: string;
  name: string;
  node_type: string;
  location?: { latitude?: number; longitude?: number; amap_poi_id?: string };
};
type Endpoint = { source: "node" | "search" | "current"; nodeId?: string; name: string; longitude: number; latitude: number; poi_id?: string };
type Suggestion = { id?: string; name: string; address?: string; district?: string; longitude: number; latitude: number };
type CommuteMode = "walking" | "transit" | "driving" | "bicycling";
type CommuteRoute = { id: string; duration_seconds: number | null; distance_meters: number | null; walking_meters?: number | null; transfer_count?: number | null; estimated_cost_cny?: number | null; taxi_cost_cny?: number | null; traffic_lights?: number | null; steps: string[]; polyline: string };
type CommuteResult = { mode: CommuteMode; origin: Endpoint; destination: Endpoint; routes: CommuteRoute[]; queried_at: string; source: "amap" };

const modeOptions: Array<{ id: CommuteMode; label: string; amap: string }> = [
  { id: "walking", label: "步行", amap: "walk" },
  { id: "transit", label: "公交", amap: "bus" },
  { id: "driving", label: "驾车", amap: "car" },
  { id: "bicycling", label: "骑行", amap: "ride" },
];
const apiBase = (import.meta.env.VITE_COMMUTE_API_BASE ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${apiBase}${path}`;

function endpointFromNode(node?: PlannerNode): Endpoint | null {
  if (!node || typeof node.location?.latitude !== "number" || typeof node.location.longitude !== "number") return null;
  return { source: "node", nodeId: node.id, name: node.name, longitude: node.location.longitude, latitude: node.location.latitude, poi_id: node.location.amap_poi_id };
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "时间待返回";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}小时${minutes % 60 ? `${minutes % 60}分` : ""}` : `${minutes}分钟`;
}

function formatDistance(meters: number | null | undefined) {
  if (meters == null) return "距离待返回";
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

export function CommutePlanner({ nodes, cityName, cityCode }: { nodes: PlannerNode[]; cityName: string; cityCode: string }) {
  const locatedNodes = useMemo(() => nodes.filter((node) => endpointFromNode(node)), [nodes]);
  const [origin, setOrigin] = useState<Endpoint | null>(() => endpointFromNode(locatedNodes[0]));
  const [destination, setDestination] = useState<Endpoint | null>(() => endpointFromNode(locatedNodes[1]));
  const [mode, setMode] = useState<CommuteMode>("transit");
  const [result, setResult] = useState<CommuteResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const swap = () => { setOrigin(destination); setDestination(origin); setResult(null); };
  const locate = (setter: (value: Endpoint) => void) => {
    if (!navigator.geolocation) { setStatus("error"); setMessage("当前浏览器不支持定位。"); return; }
    setMessage("正在获取当前位置…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setter({ source: "current", name: "我的当前位置", longitude: coords.longitude, latitude: coords.latitude }); setMessage(""); },
      () => { setStatus("error"); setMessage("无法取得当前位置，请检查浏览器定位权限。"); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const query = async () => {
    if (!origin || !destination) { setStatus("error"); setMessage("请先选择有效的起点和终点。"); return; }
    if (origin.longitude === destination.longitude && origin.latitude === destination.latitude) { setStatus("error"); setMessage("起点和终点不能相同。"); return; }
    setStatus("loading"); setMessage(""); setResult(null);
    try {
      const response = await fetch(apiUrl("/api/commute"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin, destination, mode, city_code: cityCode }) });
      const payload = await response.json() as CommuteResult & { error?: string; code?: string };
      if (!response.ok) throw new Error(payload.code === "CONFIG_REQUIRED" ? "通勤服务已完成，但尚未配置高德 Web 服务 Key。" : payload.error || "通勤查询失败。");
      setResult(payload); setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error && !error.message.includes("JSON") ? error.message : "通勤代理尚未部署或地址未配置，请检查服务设置。");
    }
  };

  return <section className="commute-planner" aria-label="城市通勤查询">
    <div className="commute-title"><div><span>AMAP COMMUTE</span><h2>查询城市通勤</h2></div><p>动态结果不写入数据库 · 当前城市：{cityName}</p></div>
    <div className="commute-controls">
      <EndpointPicker label="从哪里出发" value={origin} nodes={locatedNodes} cityName={cityName} onChange={setOrigin} onLocate={() => locate(setOrigin)} />
      <button type="button" className="swap-button" onClick={swap} aria-label="交换起点和终点">⇄</button>
      <EndpointPicker label="要去哪里" value={destination} nodes={locatedNodes} cityName={cityName} onChange={setDestination} onLocate={() => locate(setDestination)} />
      <div className="mode-picker" aria-label="交通方式">{modeOptions.map((option) => <button type="button" key={option.id} className={mode === option.id ? "is-active" : ""} onClick={() => { setMode(option.id); setResult(null); }}>{option.label}</button>)}</div>
      <button type="button" className="commute-submit" onClick={query} disabled={status === "loading"}>{status === "loading" ? "正在查询…" : "开始查询"}</button>
    </div>
    {message && <div className={`commute-message ${status === "error" ? "is-error" : ""}`}>{message}</div>}
    {result && <CommuteResults result={result} />}
  </section>;
}

function EndpointPicker({ label, value, nodes, cityName, onChange, onLocate }: { label: string; value: Endpoint | null; nodes: PlannerNode[]; cityName: string; onChange: (value: Endpoint | null) => void; onLocate: () => void }) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const requestId = useRef(0);

  useEffect(() => { if (value) setQuery(value.name); }, [value]);
  useEffect(() => {
    if (query.trim().length < 2 || query === value?.name) { setSuggestions([]); return; }
    const current = ++requestId.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(apiUrl(`/api/places?keywords=${encodeURIComponent(query.trim())}&city=${encodeURIComponent(cityName)}`));
        const payload = await response.json() as { suggestions?: Suggestion[]; error?: string; code?: string };
        if (current !== requestId.current) return;
        if (!response.ok) { setSearchMessage(payload.code === "CONFIG_REQUIRED" ? "配置高德 Key 后启用自由地点搜索" : payload.error ?? "地点搜索失败"); setSuggestions([]); return; }
        setSuggestions(payload.suggestions ?? []); setSearchMessage("");
      } catch { if (current === requestId.current) setSearchMessage("地点搜索服务尚未连接"); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, value?.name, cityName]);

  return <div className="endpoint-picker"><label>{label}</label><div className="endpoint-row"><select value={value?.source === "node" ? value.nodeId : ""} onChange={(event) => { const node = nodes.find((item) => item.id === event.target.value); onChange(endpointFromNode(node)); }}><option value="">数据库节点</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select><button type="button" onClick={onLocate}>当前位置</button></div><div className="place-input-wrap"><input value={query} onChange={(event) => { setQuery(event.target.value); if (event.target.value !== value?.name) onChange(null); }} placeholder={`输入${cityName}地点`} aria-label={`${label}自由地点搜索`} />{suggestions.length > 0 && <div className="place-suggestions">{suggestions.map((suggestion) => <button type="button" key={`${suggestion.id}-${suggestion.longitude}`} onClick={() => { onChange({ source: "search", name: suggestion.name, longitude: suggestion.longitude, latitude: suggestion.latitude, poi_id: suggestion.id }); setQuery(suggestion.name); setSuggestions([]); }}><b>{suggestion.name}</b><span>{suggestion.address || suggestion.district}</span></button>)}</div>}</div>{searchMessage && <small>{searchMessage}</small>}</div>;
}

function CommuteResults({ result }: { result: CommuteResult }) {
  const option = modeOptions.find((item) => item.id === result.mode) ?? modeOptions[0];
  return <div className="commute-results"><div className="result-heading"><div><span>实时查询结果</span><h3>{result.origin.name} → {result.destination.name}</h3></div><small>{new Date(result.queried_at).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })} · 高德</small></div>{result.routes.length ? <div className="route-result-grid">{result.routes.map((route, index) => <article className="route-result" key={route.id}><div className="route-rank"><span>方案 {index + 1}</span><b>{option.label}</b></div><RoutePreview route={route} origin={result.origin} destination={result.destination} /><div className="route-metrics"><strong>{formatDuration(route.duration_seconds)}</strong><b>{formatDistance(route.distance_meters)}</b>{route.walking_meters != null && <span>步行 {formatDistance(route.walking_meters)}</span>}{route.transfer_count != null && <span>换乘 {route.transfer_count} 次</span>}{route.taxi_cost_cny != null && <span>打车约 ¥{route.taxi_cost_cny}</span>}{route.estimated_cost_cny != null && route.estimated_cost_cny > 0 && <span>费用约 ¥{route.estimated_cost_cny}</span>}</div>{route.steps.length > 0 && <details><summary>查看详细步骤</summary><ol>{route.steps.slice(0, 16).map((step, stepIndex) => <li key={`${stepIndex}-${step}`}>{step}</li>)}</ol></details>}<a className="amap-navigation" href={amapLink(result.origin, result.destination, option.amap)} target="_blank" rel="noreferrer">在高德中打开 ↗</a></article>)}</div> : <div className="commute-message is-error">高德没有返回可用路线，请更换交通方式或地点。</div>}</div>;
}

function amapLink(origin: Endpoint, destination: Endpoint, mode: string) {
  const params = new URLSearchParams({ from: `${origin.longitude},${origin.latitude},${origin.name}`, to: `${destination.longitude},${destination.latitude},${destination.name}`, mode, policy: "1", src: "赣行志", coordinate: "gaode", callnative: "0" });
  return `https://uri.amap.com/navigation?${params}`;
}

function RoutePreview({ route, origin, destination }: { route: CommuteRoute; origin: Endpoint; destination: Endpoint }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const pairs = route.polyline.split(";").map((pair) => pair.split(",").map(Number)).filter((pair) => pair.length === 2 && pair.every(Number.isFinite));
    const points = pairs.length >= 2 ? pairs : [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]];
    const draw = () => {
      const width = canvas.clientWidth, height = canvas.clientHeight, ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio; canvas.height = height * ratio;
      const context = canvas.getContext("2d"); if (!context) return; context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
      context.strokeStyle = "rgba(23,27,24,.08)"; context.lineWidth = 1;
      for (let x = 0; x < width; x += 24) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += 24) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]); const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys); const spanX = Math.max(maxX - minX, .001), spanY = Math.max(maxY - minY, .001);
      const project = ([x, y]: number[]) => [16 + (x - minX) / spanX * (width - 32), 16 + (maxY - y) / spanY * (height - 32)];
      context.beginPath(); points.forEach((point, index) => { const [x, y] = project(point); if (index) context.lineTo(x, y); else context.moveTo(x, y); }); context.strokeStyle = "#a83a29"; context.lineWidth = 3; context.lineJoin = "round"; context.lineCap = "round"; context.stroke();
      const markers = [project(points[0]), project(points[points.length - 1])]; markers.forEach(([x, y], index) => { context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fillStyle = index ? "#a83a29" : "#49866f"; context.fill(); context.strokeStyle = "#f3f0e8"; context.lineWidth = 2; context.stroke(); });
    };
    const observer = new ResizeObserver(draw); observer.observe(canvas); draw(); return () => observer.disconnect();
  }, [route, origin, destination]);
  return <div className="route-preview"><canvas ref={canvasRef} aria-label="高德返回路线空间示意" /><span>GCJ‑02 路线示意</span></div>;
}
