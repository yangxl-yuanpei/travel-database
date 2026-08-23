/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: unknown;
  AMAP_WEB_SERVICE_KEY?: string;
  COMMUTE_ALLOWED_ORIGINS?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

type CommuteMode = "walking" | "transit" | "driving" | "bicycling";
type PointInput = { name?: string; longitude: number; latitude: number; poi_id?: string };
type CommuteInput = { origin: PointInput; destination: PointInput; mode: CommuteMode; city_code?: string; city_adcode?: string };
type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validPoint(value: unknown): value is PointInput {
  const point = record(value);
  return typeof point.longitude === "number" && typeof point.latitude === "number"
    && point.longitude >= 70 && point.longitude <= 140 && point.latitude >= 0 && point.latitude <= 60;
}

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const requestOrigin = new URL(request.url).origin;
  const allowed = (env.COMMUTE_ALLOWED_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (origin !== requestOrigin && !local && !allowed.includes(origin)) return {};
  return { "access-control-allow-origin": origin, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", "vary": "Origin" };
}

function routeEndpoint(mode: CommuteMode) {
  if (mode === "transit") return "https://restapi.amap.com/v5/direction/transit/integrated";
  return `https://restapi.amap.com/v5/direction/${mode}`;
}

function stepSummary(step: UnknownRecord) {
  return text(step.instruction) || text(step.road_name) || text(step.action);
}

function normalizeStandardRoute(payload: UnknownRecord, mode: CommuteMode) {
  const route = record(payload.route);
  return array(route.paths).slice(0, 3).map((rawPath, index) => {
    const path = record(rawPath), cost = record(path.cost);
    const steps = array(path.steps).map((item) => record(item));
    return {
      id: `${mode}-${index + 1}`,
      duration_seconds: numeric(cost.duration ?? path.duration),
      distance_meters: numeric(path.distance),
      estimated_cost_cny: numeric(cost.tolls ?? path.tolls),
      taxi_cost_cny: numeric(route.taxi_cost ?? cost.taxi),
      traffic_lights: numeric(cost.traffic_lights),
      steps: steps.map(stepSummary).filter(Boolean),
      polyline: steps.map((step) => text(step.polyline)).filter(Boolean).join(";"),
    };
  });
}

function normalizeTransitRoute(payload: UnknownRecord) {
  const route = record(payload.route);
  return array(route.transits).slice(0, 3).map((rawTransit, index) => {
    const transit = record(rawTransit), cost = record(transit.cost);
    const segments = array(transit.segments).map((item) => record(item));
    const instructions: string[] = [];
    const polylines: string[] = [];
    let transfers = 0;
    for (const segment of segments) {
      const walking = record(segment.walking);
      for (const item of array(walking.steps)) {
        const step = record(item); const summary = stepSummary(step);
        if (summary) instructions.push(summary); if (text(step.polyline)) polylines.push(text(step.polyline));
      }
      const bus = record(segment.bus);
      const buslines = array(bus.buslines).map((item) => record(item));
      for (const line of buslines) {
        const name = text(line.name); if (name) instructions.push(`乘坐 ${name}`); if (text(line.polyline)) polylines.push(text(line.polyline));
      }
      if (buslines.length) transfers += buslines.length;
      const railway = record(segment.railway); if (text(railway.name)) instructions.push(`乘坐 ${text(railway.name)}`);
    }
    return {
      id: `transit-${index + 1}`,
      duration_seconds: numeric(cost.duration ?? transit.duration),
      distance_meters: numeric(transit.distance),
      walking_meters: numeric(transit.walking_distance),
      transfer_count: Math.max(0, transfers - 1),
      estimated_cost_cny: numeric(cost.transit_fee ?? transit.cost),
      steps: instructions,
      polyline: polylines.join(";"),
    };
  });
}

async function handlePlaceSearch(request: Request, env: Env, headers: HeadersInit) {
  if (!env.AMAP_WEB_SERVICE_KEY) return json({ error: "高德 Web 服务 Key 尚未配置", code: "CONFIG_REQUIRED" }, 503, headers);
  const url = new URL(request.url), keywords = url.searchParams.get("keywords")?.trim();
  if (!keywords || keywords.length < 2 || keywords.length > 40) return json({ error: "请输入 2–40 个字符的地点名称", code: "INVALID_KEYWORDS" }, 400, headers);
  const params = new URLSearchParams({ key: env.AMAP_WEB_SERVICE_KEY, keywords, city: url.searchParams.get("city") ?? "南昌", citylimit: "true", datatype: "all" });
  let response: Response;
  try { response = await fetch(`https://restapi.amap.com/v3/assistant/inputtips?${params}`); }
  catch { return json({ error: "通勤代理暂时无法连接高德服务", code: "AMAP_UNREACHABLE" }, 502, headers); }
  const payload = record(await response.json());
  if (!response.ok || text(payload.status) !== "1") return json({ error: text(payload.info) || "地点搜索失败", code: text(payload.infocode) || "AMAP_ERROR" }, 502, headers);
  const suggestions = array(payload.tips).map((item) => record(item)).flatMap((tip) => {
    const location = text(tip.location).split(",").map(Number);
    if (location.length !== 2 || location.some((value) => !Number.isFinite(value))) return [];
    return [{ id: text(tip.id), name: text(tip.name), address: text(tip.address) || text(tip.district), district: text(tip.district), longitude: location[0], latitude: location[1] }];
  }).slice(0, 8);
  return json({ suggestions }, 200, headers);
}

async function handleCommute(request: Request, env: Env, headers: HeadersInit) {
  if (!env.AMAP_WEB_SERVICE_KEY) return json({ error: "高德 Web 服务 Key 尚未配置", code: "CONFIG_REQUIRED" }, 503, headers);
  let body: UnknownRecord;
  try { body = record(await request.json()); } catch { return json({ error: "请求 JSON 无效", code: "INVALID_JSON" }, 400, headers); }
  const modes: CommuteMode[] = ["walking", "transit", "driving", "bicycling"];
  if (!validPoint(body.origin) || !validPoint(body.destination) || !modes.includes(body.mode as CommuteMode)) return json({ error: "起点、终点或交通方式无效", code: "INVALID_INPUT" }, 400, headers);
  const input = body as unknown as CommuteInput;
  const formatPoint = (point: PointInput) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`;
  const params = new URLSearchParams({ key: env.AMAP_WEB_SERVICE_KEY, origin: formatPoint(input.origin), destination: formatPoint(input.destination), show_fields: "cost,navi,polyline", alternative_route: "3" });
  if (input.mode === "transit") {
    params.set("city1", input.city_code ?? "0791"); params.set("city2", input.city_code ?? "0791"); params.set("AlternativeRoute", "3"); params.set("strategy", "0");
    params.delete("alternative_route");
    if (input.origin.poi_id && input.destination.poi_id) { params.set("originpoi", input.origin.poi_id); params.set("destinationpoi", input.destination.poi_id); }
  } else {
    if (input.origin.poi_id) params.set("origin_id", input.origin.poi_id);
    if (input.destination.poi_id) params.set("destination_id", input.destination.poi_id);
  }
  let response: Response;
  try { response = await fetch(`${routeEndpoint(input.mode)}?${params}`); }
  catch { return json({ error: "通勤代理暂时无法连接高德服务", code: "AMAP_UNREACHABLE" }, 502, headers); }
  const payload = record(await response.json());
  if (!response.ok || text(payload.status) !== "1") return json({ error: text(payload.info) || "通勤查询失败", code: text(payload.infocode) || "AMAP_ERROR" }, 502, headers);
  const routes = input.mode === "transit" ? normalizeTransitRoute(payload) : normalizeStandardRoute(payload, input.mode);
  return json({ mode: input.mode, origin: input.origin, destination: input.destination, routes, queried_at: new Date().toISOString(), source: "amap" }, 200, { ...headers, "cache-control": "private, max-age=60" });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/commute") || url.pathname.startsWith("/api/places")) {
      const headers = corsHeaders(request, env);
      const origin = request.headers.get("origin");
      if (origin && !("access-control-allow-origin" in headers)) return json({ error: "该网页来源未被允许", code: "ORIGIN_NOT_ALLOWED" }, 403);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
      if (url.pathname === "/api/places" && request.method === "GET") return handlePlaceSearch(request, env, headers);
      if (url.pathname === "/api/commute" && request.method === "POST") return handleCommute(request, env, headers);
      return json({ error: "不支持的请求方法", code: "METHOD_NOT_ALLOWED" }, 405, headers);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
