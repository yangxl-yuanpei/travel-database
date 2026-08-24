"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import atlasData from "../generated/atlas.json";
import { CommutePlanner } from "./CommutePlanner";

type JsonObject = Record<string, unknown>;
type Source = { name: string; url: string; scope?: string[] };
type Location = { address?: string; latitude?: number; longitude?: number; coordinate_system?: string; amap_poi_id?: string; map_anchor?: string };
type TravelNode = {
  id: string; name: string; short_name?: string; city?: string; node_type: string; map_index?: string;
  category?: string[]; tags?: string[]; location?: Location; official_info?: JsonObject; reservation?: JsonObject;
  experience?: JsonObject; experience_layer?: JsonObject; holiday_reference?: JsonObject; ai_score?: Record<string, number | null>;
  food_scope?: "area" | "restaurant" | "dish"; meal_periods?: string[]; menu_profile?: JsonObject; price_range_cny?: JsonObject;
  suitable_for?: string[]; transit_profile?: JsonObject; spatial_layer?: JsonObject; amap_integration?: JsonObject;
  remote_transport_profile?: JsonObject; route_profile?: JsonObject;
  duration?: { recommended_minutes?: number; minimum_minutes?: number; maximum_minutes?: number };
  children?: TravelNode[]; sources?: Source[]; metadata?: JsonObject;
};
type City = TravelNode & { province?: string; journey_role?: string; detail_status?: string; primary_station?: { name?: string; station_code?: string } };
type Transport = TravelNode & {
  from_city_id: string; to_city_id: string; route_role: string; recommended_mode: string;
  stations: { from: string; to: string };
  rail_reference: { sample_date: string; direct: boolean; duration_minutes: { minimum: number; maximum: number }; second_class_fare_cny: { minimum: number; maximum: number }; sample_trains?: string[]; fallback?: string; status: string; national_day_sale_status: string };
};
type Journey = TravelNode & { travel_window: { start: string; end: string; days: number }; transport_policy: { rail_reference_rule: string; presale_note: string; amap_role: string } };
type ItineraryAlternative = { label: string; title: string; node_id?: string; description: string; difference: string };
type ItineraryScheduleItem = { time: string; title: string; kind: string; node_id?: string; transport_id?: string; duration_minutes?: number; description: string; transit_from_previous?: string; alternative?: ItineraryAlternative };
type ItineraryLodging = { recommended_area_id?: string; recommended_area: string; reason: string; alternative_area_id?: string; alternative_area?: string; difference?: string };
type ItineraryDay = { day: number; city_id: string; city_name: string; theme: string; summary: string; schedule: ItineraryScheduleItem[]; lodging: ItineraryLodging };
type BookingItem = { item: string; timing: string; status: string; note: string };
type MountainTransferOption = { priority: string; name: string; route: string; booking: string; reference: string; best_for: string; tradeoff: string; status: string };
type MountainTransfer = { direction: "outbound" | "return"; title: string; planned_time: string; summary: string; options: MountainTransferOption[] };
type Itinerary = TravelNode & { duration_days: number; target_period: string; summary: string; route_city_ids: string[]; days: ItineraryDay[]; mountain_transfers?: MountainTransfer[]; booking_checklist: BookingItem[]; dynamic_rules: Record<string, string> };
type Atlas = { journey: Journey; cities: City[]; transports: Transport[]; itineraries: Itinerary[]; city_places: Record<string, TravelNode[]> };
type MapPoint = { city: City; x: number; y: number };

const atlas = atlasData as unknown as Atlas;
const scoreLabels: Record<string, string> = { history: "历史", photo: "拍照", family: "亲子", rain_day: "雨天", crowd_risk: "拥挤风险", queue_risk: "排队风险", first_visit: "首次到访", night: "夜景", local_character: "本地特色", value: "性价比", late_night: "夜宵适配", transit: "交通便利", walkability: "步行串联", quiet: "安静度", river_view: "江景", holiday_price_risk: "假日涨价风险" };
const sectionLabels: Record<string, string> = { permanent_exhibition: "常设展陈", temporary_exhibition: "临时展览", artifact: "精品文物", collection_group: "藏品专题", history_event: "历史事件", historic_site: "关联旧址", archaeological_site: "考古遗址", attraction: "核心景区与景观", transport: "景区交通", food_restaurant: "候选店铺", food_dish: "候选菜品" };
const mealLabels: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", late_night: "夜宵", afternoon: "下午茶", evening: "晚间", anytime: "随时" };

function object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
function string(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function number(value: unknown): number | null { return typeof value === "number" ? value : null; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function contents(value: unknown): string[] { return Array.isArray(value) ? value.map((item) => string(object(item).content)).filter((item): item is string => Boolean(item)) : []; }
function formatMinutes(value: number) { const h = Math.floor(value / 60); const m = value % 60; return `${h ? `${h}小时` : ""}${m ? `${m}分` : ""}`; }
function range(min: number, max: number, formatter: (value: number) => string) { return min === max ? formatter(min) : `${formatter(min)}–${formatter(max)}`; }
function duration(place: TravelNode): string { const layerDuration = object(object(place.experience_layer).recommended_duration); const min = place.duration?.minimum_minutes ?? number(layerDuration.minimum_minutes) ?? undefined; const max = place.duration?.maximum_minutes ?? number(layerDuration.recommended_max_minutes) ?? undefined; return min && max ? range(min, max, formatMinutes) : "时长待补充"; }
function placeType(place: TravelNode): string { if (place.node_type === "museum") return "博物馆"; if (place.node_type === "memorial") return "纪念馆"; if (place.node_type === "food") return "美食节点"; if (place.node_type === "accommodation_area") return "住宿区域"; return place.category?.[0] ?? "城市景点"; }
function lead(place: TravelNode): string { const official = object(place.official_info), experience = object(place.experience); return string(official.description) ?? string(official.positioning) ?? string(experience.summary) ?? strings(experience.highlights).join("、"); }
function openingText(place: TravelNode): string { const hours = object(object(place.official_info).opening_hours); return string(hours.regular_schedule) ?? string(hours.regular) ?? "开放时间等待官方核验"; }
function ticketText(place: TravelNode): string { const ticket = object(object(place.official_info).ticket); const amount = number(object(ticket.general_admission).amount) ?? number(ticket.price); const textPrice = string(ticket.price); return amount === 0 || textPrice === "免费" ? "免费开放" : amount ? `¥${amount}` : "票价动态维护"; }
function reservationText(place: TravelNode): string { if (!place.reservation) return "以官方公告为准"; const required = place.reservation.required === true ? "须实名预约" : place.reservation.required === false ? "无需预约" : "预约规则待核验"; const days = number(place.reservation.advance_days); return days ? `${required} · 提前 ${days} 天` : required; }
function foodPeriods(place: TravelNode): string { return (place.meal_periods ?? []).map((item) => mealLabels[item] ?? item).join("、") || "适合时段待核验"; }
function foodPrice(place: TravelNode): string {
  const price = object(place.price_range_cny), average = number(price.average_reference), minimum = number(price.minimum), maximum = number(price.maximum);
  if (average !== null) return `人均约 ¥${average}`;
  if (minimum !== null && maximum !== null) return `参考 ¥${minimum}–${maximum}`;
  return "价格动态维护";
}
function stayFit(place: TravelNode): string { return (place.suitable_for ?? []).slice(0, 2).join("、") || "适合人群待补充"; }
function stayRisk(value: unknown): string { const labels: Record<string, string> = { low: "低", "low-medium": "中低", medium: "中", "medium-high": "中高", high: "高" }; return labels[string(value) ?? ""] ?? string(value) ?? "待核验"; }
const holidayFactLabels: Record<string, string> = {
  opening_schedule: "开放时间", special_night_session: "特别夜场", reservation_rule: "预约规则", advance_window: "预约窗口",
  advance_days: "提前天数", channels: "预约渠道", official_channels: "官方渠道", entry_rule: "入园核验", late_open_area: "晚间开放范围",
  extra_quota: "增发名额", document_rule: "证件核验", release_times: "放票时段", order_limit: "单账号限制",
  reservation_advice: "预约提示", refund_advice: "退票提示", holiday_visitors: "历史客流", crowd_observation: "客流观察", parent_area: "空间关系"
};
function holidayFactValue(value: unknown): string { if (Array.isArray(value)) return value.join("、"); if (typeof value === "number") return String(value); return string(value) ?? "待核验"; }
function childDescription(child: TravelNode): string {
  if (child.node_type === "food") {
    const dishes = strings(object(child.menu_profile).recommended_dishes);
    return [foodPrice(child), dishes.length ? `推荐：${dishes.slice(0, 4).join("、")}` : null].filter(Boolean).join(" · ") || "候选信息持续核验中";
  }
  const official = object(child.official_info); return string(official.description) ?? string(official.theme) ?? ([string(official.period), string(official.category), string(official.site_type)].filter(Boolean).join(" · ") || "详细内容持续核验中");
}
function go(id: string) { window.location.hash = id; }

export function MapExplorer() {
  const [viewId, setViewId] = useState("overview");
  useEffect(() => {
    const sync = () => setViewId(window.location.hash.slice(1) || "overview");
    sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync);
  }, []);
  const place = Object.values(atlas.city_places).flat().find((item) => item.id === viewId);
  const city = atlas.cities.find((item) => item.id === viewId);
  const itinerary = atlas.itineraries.find((item) => item.id === viewId);
  const placeCity = place ? atlas.cities.find((item) => item.name === place.city) : undefined;
  if (itinerary) return <ItineraryPage itinerary={itinerary} />;
  if (place) return <PlaceDetail place={place} cityName={placeCity?.name ?? place.city ?? "城市"} onBack={() => go(placeCity?.id ?? "overview")} />;
  if (city && (city.detail_status === "active" || (atlas.city_places[city.id]?.length ?? 0) > 0)) return <DetailedCityPage city={city} />;
  if (city) return <CityFramework city={city} />;
  return <JourneyOverview />;
}

function SiteHeader({ compact = false }: { compact?: boolean }) {
  return <header className={compact ? "topbar topbar-compact" : "topbar"}>
    <button className="brand" type="button" onClick={() => go("overview")}><span className="brand-mark">赣</span><span>赣行志</span></button>
    <div className="header-right"><span className="edition">2026 · 国庆协同地图</span>{compact && <button type="button" className="text-link" onClick={() => go("overview")}>返回总览</button>}</div>
  </header>;
}

function JourneyOverview() {
  const projected = useMemo(() => {
    const points = atlas.cities.map((city) => ({ city, lat: city.location?.latitude ?? 0, lon: city.location?.longitude ?? 0 }));
    const minLat = 20.5, maxLat = 41.2, minLon = 111.5, maxLon = 122.3;
    return points.map((point) => ({ ...point, x: 7 + ((point.lon - minLon) / (maxLon - minLon)) * 86, y: 7 + ((maxLat - point.lat) / (maxLat - minLat)) * 86 }));
  }, []);
  return <main className="atlas-page">
    <SiteHeader />
    <section className="atlas-hero">
      <div className="atlas-copy">
        <p className="eyebrow">THREE ORIGINS · ONE JIANGXI JOURNEY</p>
        <h1>三城出发，<br />在南昌会合。</h1>
        <p className="intro">北京、上海与珠海各自启程，在英雄城汇合，再沿赣东北进入景德镇与上饶。主页先管理城市和交通，城市页继续承载可检索的旅行节点。</p>
        <div className="journey-stat"><span><b>3</b> 个出发地</span><span><b>6</b> 座城市</span><span><b>5</b> 条铁路边</span></div>
      </div>
      <div className="network-shell">
        <div className="map-head"><div><span className="live-dot" />跨城交通网络</div><span>GCJ‑02 空间锚点</span></div>
        <div className="network-map">
          <div className="map-watermark">CHINA<br /><b>→ JIANGXI</b></div>
          <RouteCanvas points={projected} transports={atlas.transports} />
          {projected.map(({ city, x, y }) => <button type="button" key={city.id} className={`city-pin ${city.id === "city_nanchang" ? "is-hub" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => go(city.id)}><span /> <b>{city.name}</b><small>{city.journey_role}</small></button>)}
          <div className="map-legend"><span><i />会合线</span><span><i className="main" />江西主线</span></div>
        </div>
        <div className="network-foot"><b>行程骨架</b><span>珠海 / 北京 / 上海</span><i>→</i><strong>南昌</strong><i>→</i><span>景德镇</span><i>→</i><span>上饶</span></div>
      </div>
    </section>

    {atlas.itineraries[0] && <ItinerarySpotlight itinerary={atlas.itineraries[0]} />}

    <section className="transport-section">
      <div className="section-heading"><div><p className="section-kicker">RAIL BASELINE · 2026-08</p><h2>先看大交通，再进入城市</h2></div><p>票价与时长为常态样本，不是国庆承诺价。</p></div>
      <div className="transport-grid">{atlas.transports.map((transport) => <TransportCard key={transport.id} transport={transport} />)}</div>
    </section>
    <section className="data-notice"><div><span>12306</span><h3>国庆车票尚未开售</h3><p>{atlas.journey.transport_policy.presale_note}</p></div><div><span>高德 API</span><h3>空间层已就位</h3><p>{atlas.journey.transport_policy.amap_role}</p></div></section>
    <footer className="site-footer">数据分层：铁路票价 / 时刻以 12306 为准 · 地图与接驳由高德 API 动态计算 · 最后核对 2026-08-24</footer>
  </main>;
}

function ItinerarySpotlight({ itinerary }: { itinerary: Itinerary }) {
  return <section className="itinerary-spotlight">
    <div className="itinerary-spotlight-copy">
      <p className="section-kicker">CURATED ITINERARY · CURRENT PLAN</p>
      <h2>{itinerary.duration_days}日经典路线</h2>
      <p>{itinerary.summary}</p>
      <button type="button" onClick={() => go(itinerary.id)}>查看每日详细计划 <span>→</span></button>
    </div>
    <div className="itinerary-mini-days">
      {itinerary.days.map((day) => <article key={day.day}>
        <span>D{day.day}</span><div><b>{day.city_name}</b><small>{day.theme}</small></div>
      </article>)}
    </div>
  </section>;
}

function ItineraryPage({ itinerary }: { itinerary: Itinerary }) {
  const [activeDay, setActiveDay] = useState(0);
  const day = itinerary.days[activeDay] ?? itinerary.days[0];
  const transportById = new Map(atlas.transports.map((item) => [item.id, item]));
  const cityNameById = new Map(atlas.cities.map((item) => [item.id, item.name]));

  return <main className="itinerary-page">
    <SiteHeader compact />
    <section className="itinerary-hero">
      <div>
        <p className="eyebrow">{itinerary.target_period} · FIXED REFERENCE</p>
        <h1>{itinerary.name}</h1>
        <p>{itinerary.summary}</p>
      </div>
      <div className="itinerary-route-line">
        {itinerary.route_city_ids.map((id, index) => <span key={id}><i>{String(index + 1).padStart(2, "0")}</i><b>{cityNameById.get(id) ?? id}</b></span>)}
      </div>
    </section>

    <nav className="itinerary-day-tabs" aria-label="选择每日行程">
      {itinerary.days.map((item, index) => <button type="button" key={item.day} className={activeDay === index ? "is-active" : ""} aria-pressed={activeDay === index} onClick={() => setActiveDay(index)}>
        <span>D{item.day}</span><b>{item.city_name}</b><small>{item.theme}</small>
      </button>)}
    </nav>

    <section className="itinerary-day-panel">
      <header>
        <div><p className="section-kicker">DAY {day.day} · {day.city_name}</p><h2>{day.theme}</h2><p>{day.summary}</p></div>
        <div className="itinerary-stay"><span>当晚住宿</span><b>{day.lodging.recommended_area}</b><p>{day.lodging.reason}</p></div>
      </header>

      <ol className="itinerary-timeline">
        {day.schedule.map((item, index) => {
          const transport = item.transport_id ? transportById.get(item.transport_id) : undefined;
          return <li key={`${item.time}-${item.title}-${index}`}>
            <time>{item.time}</time><i aria-hidden="true" />
            <div className="itinerary-event">
              <div className="itinerary-event-title"><b>{item.title}</b>{item.duration_minutes && <span>{formatMinutes(item.duration_minutes)}</span>}</div>
              <p>{item.description}</p>
              {transport && <small>{transport.stations.from} → {transport.stations.to} · {range(transport.rail_reference.duration_minutes.minimum, transport.rail_reference.duration_minutes.maximum, formatMinutes)} · 常态参考</small>}
              {item.transit_from_previous && <small>通勤：{item.transit_from_previous}</small>}
              {item.node_id && <button type="button" onClick={() => go(item.node_id!)}>查看节点详细攻略 →</button>}
              {item.alternative && <div className="itinerary-alternative">
                <span>{item.alternative.label}</span><div><b>{item.alternative.title}</b><p>{item.alternative.description}</p><small>区别：{item.alternative.difference}</small>{item.alternative.node_id && <button type="button" onClick={() => go(item.alternative!.node_id!)}>查看备选节点 →</button>}</div>
              </div>}
            </div>
          </li>;
        })}
      </ol>

      {day.lodging.alternative_area && <div className="itinerary-lodging-choice">
        <div><span>推荐住宿</span><b>{day.lodging.recommended_area}</b><p>{day.lodging.reason}</p>{day.lodging.recommended_area_id && <button type="button" onClick={() => go(day.lodging.recommended_area_id!)}>查看住宿区域 →</button>}</div>
        <div><span>或</span><b>{day.lodging.alternative_area}</b><p>{day.lodging.difference}</p>{day.lodging.alternative_area_id && <button type="button" onClick={() => go(day.lodging.alternative_area_id!)}>查看备选区域 →</button>}</div>
      </div>}
    </section>

    {itinerary.mountain_transfers && <section className="itinerary-transfer-section">
      <div className="section-heading"><div><p className="section-kicker">MOUNTAIN TRANSFER OPTIONS</p><h2>三清山去程与返程怎么选？</h2></div><p>2025公开数据只作参考；实际班次需在出发前通过运营渠道重新核验。</p></div>
      <div className="itinerary-transfer-groups">
        {itinerary.mountain_transfers.map((group) => <article className="itinerary-transfer-group" key={group.direction}>
          <header><span>{group.direction === "outbound" ? "去程" : "返程"}</span><div><h3>{group.title}</h3><b>{group.planned_time}</b><p>{group.summary}</p></div></header>
          <div className="itinerary-transfer-options">
            {group.options.map((option, index) => <div className={index === 0 ? "is-primary" : ""} key={option.name}>
              <span>{option.priority}</span><h4>{option.name}</h4><strong>{option.route}</strong>
              <dl><div><dt>怎么订</dt><dd>{option.booking}</dd></div><div><dt>参考</dt><dd>{option.reference}</dd></div><div><dt>适合</dt><dd>{option.best_for}</dd></div><div><dt>取舍</dt><dd>{option.tradeoff}</dd></div></dl>
            </div>)}
          </div>
        </article>)}
      </div>
    </section>}

    <section className="itinerary-checklist">
      <div className="section-heading"><div><p className="section-kicker">BOOKING CHECKLIST</p><h2>需要提前锁定什么？</h2></div><p>当前方案保存规则和核验节点，不把国庆动态时刻写死。</p></div>
      <div>{itinerary.booking_checklist.map((item, index) => <article key={item.item}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item.item}</b><small>{item.timing}</small><p>{item.note}</p></div></article>)}</div>
    </section>

    <section className="itinerary-future">
      <span>NEXT · PERSONALIZED GENERATOR</span><h2>下一步：从固定方案升级为条件生成</h2><p>{itinerary.dynamic_rules.future_generator}</p>
      <div><i>天数</i><i>必去节点</i><i>历史 / 摄影偏好</i><i>排队容忍度</i><i>预算</i><i>体力</i></div>
    </section>

    <section className="itinerary-sources"><p className="section-kicker">SOURCES</p><h2>动态规则来源</h2>{itinerary.sources?.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><b>{source.name}</b><span>{source.scope?.join(" · ")}</span><i>↗</i></a>)}</section>
    <footer className="site-footer">固定行程版本 · 最后核验 {string(object(itinerary.metadata).last_verified_at) ?? "待核验"} · 车次、天气与国庆专项公告须在出发前更新</footer>
  </main>;
}

function RouteCanvas({ points, transports }: { points: MapPoint[]; transports: Transport[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const draw = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const pointById = new Map(points.map((point) => [point.city.id, point]));

      for (const transport of transports) {
        const from = pointById.get(transport.from_city_id);
        const to = pointById.get(transport.to_city_id);
        if (!from || !to) continue;
        const x1 = from.x / 100 * width;
        const y1 = from.y / 100 * height;
        const x2 = to.x / 100 * width;
        const y2 = to.y / 100 * height;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy) || 1;
        const direction = transport.from_city_id === "city_shanghai" ? -1 : transport.from_city_id === "city_zhuhai" ? -0.55 : 0.55;
        const bend = Math.min(72, length * (transport.route_role === "main_route" ? 0.12 : 0.2)) * direction;
        const controlX = (x1 + x2) / 2 - dy / length * bend;
        const controlY = (y1 + y2) / 2 + dx / length * bend;

        context.beginPath();
        context.moveTo(x1, y1);
        context.quadraticCurveTo(controlX, controlY, x2, y2);
        context.strokeStyle = transport.route_role === "main_route" ? "#a83a29" : "rgba(23,27,24,.58)";
        context.lineWidth = transport.route_role === "main_route" ? 4 : 2.25;
        context.lineCap = "round";
        context.stroke();

        const t = .78;
        const arrowX = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * controlX + t ** 2 * x2;
        const arrowY = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * controlY + t ** 2 * y2;
        const tangentX = 2 * (1 - t) * (controlX - x1) + 2 * t * (x2 - controlX);
        const tangentY = 2 * (1 - t) * (controlY - y1) + 2 * t * (y2 - controlY);
        context.save();
        context.translate(arrowX, arrowY);
        context.rotate(Math.atan2(tangentY, tangentX));
        context.beginPath();
        context.moveTo(6, 0);
        context.lineTo(-4, -4);
        context.lineTo(-4, 4);
        context.closePath();
        context.fillStyle = context.strokeStyle;
        context.fill();
        context.restore();
      }
    };

    const observer = new ResizeObserver(draw);
    observer.observe(container);
    draw();
    return () => observer.disconnect();
  }, [points, transports]);

  return <canvas ref={canvasRef} className="route-canvas" aria-hidden="true" />;
}

function TransportCard({ transport }: { transport: Transport }) {
  const rail = transport.rail_reference;
  return <article className={`transport-card ${transport.route_role === "main_route" ? "is-main" : ""}`}>
    <div className="transport-top"><span>{transport.route_role === "main_route" ? "江西主线" : "会合交通"}</span><small>{rail.direct ? "直达参考" : "中转"}</small></div>
    <h3>{transport.name}</h3><p>{transport.stations.from} <i>→</i> {transport.stations.to}</p>
    <div className="rail-numbers"><b>{range(rail.duration_minutes.minimum, rail.duration_minutes.maximum, formatMinutes)}</b><strong>{range(rail.second_class_fare_cny.minimum, rail.second_class_fare_cny.maximum, (v) => `¥${v}`)}</strong></div>
    <small>二等座 · {rail.sample_date} 常态样本{rail.fallback ? ` · 备选：${rail.fallback}` : ""}</small>
  </article>;
}

type CityLayer = "attractions" | "food" | "accommodation";
const cityLayers: Array<{ id: CityLayer; label: string; en: string }> = [
  { id: "attractions", label: "景点", en: "SIGHTS" },
  { id: "food", label: "美食", en: "FOOD" },
  { id: "accommodation", label: "住宿", en: "STAY" },
];

const cityCodeByName: Record<string, string> = { "南昌": "0791", "景德镇": "0798", "上饶": "0793" };

function DetailedCityPage({ city }: { city: City }) {
  const allPlaces = atlas.city_places[city.id] ?? [];
  const attractionPlaces = allPlaces.filter((place) => ["attraction", "museum", "memorial"].includes(place.node_type));
  const foodPlaces = allPlaces.filter((place) => place.node_type === "food");
  const accommodationPlaces = allPlaces.filter((place) => place.node_type === "accommodation_area");
  const layerPlaces: Record<CityLayer, TravelNode[]> = { attractions: attractionPlaces, food: foodPlaces, accommodation: accommodationPlaces };
  const [layer, setLayer] = useState<CityLayer>("attractions");
  const [selectedId, setSelectedId] = useState(attractionPlaces[0]?.id);
  const places = layerPlaces[layer];
  const selected = places.find((place) => place.id === selectedId) ?? places[0];
  const cityEn = city.id.replace("city_", "").toUpperCase();
  const copy = layer === "food"
    ? { eyebrow: `${cityEn} · FOOD MAP`, title: `吃在${city.name}`, intro: "以美食区域为主节点，以景点作为弱化参照；菜品与代表店铺进入区域详情。" }
    : layer === "accommodation"
      ? { eyebrow: `${cityEn} · STAY MAP`, title: "住在哪里", intro: `已建立 ${accommodationPlaces.length} 个住宿区域节点；具体酒店、价格与通勤通过高德动态查询。` }
      : { eyebrow: `${cityEn} · CITY KNOWLEDGE MAP`, title: city.name, intro: `${city.journey_role ?? "城市节点"} · 当前已有 ${attractionPlaces.length} 个城市级景点节点。` };

  const changeLayer = (next: CityLayer) => {
    setLayer(next);
    setSelectedId(layerPlaces[next][0]?.id);
  };

  return <main className={`city-page layer-${layer}`}><SiteHeader compact />
    <nav className="city-layer-nav" aria-label={`${city.name}城市地图图层`}>{cityLayers.map((item) => <button type="button" key={item.id} className={layer === item.id ? "is-active" : ""} onClick={() => changeLayer(item.id)}><span>{item.en}</span><b>{item.label}</b><i>{layerPlaces[item.id].length || "待接入"}</i></button>)}</nav>
    <CommutePlanner nodes={allPlaces} cityName={city.name} cityCode={cityCodeByName[city.name] ?? ""} />
    <section className="city-hero"><div className="city-copy"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="intro">{copy.intro}</p><button type="button" className="back-route" onClick={() => go("overview")}>← 查看跨城交通</button></div>
      {places.length > 0
        ? <CityNodeMap city={city} places={places} referencePlaces={layer === "attractions" ? [] : attractionPlaces} selected={selected} onSelect={setSelectedId} waterLabel={city.name === "南昌" ? "赣 江" : undefined} mode={layer} />
        : <CityNodeMap city={city} places={attractionPlaces} selected={undefined} onSelect={() => undefined} waterLabel={city.name === "南昌" ? "赣 江" : undefined} mode="reference" />}
    </section>
    {places.length > 0 && <section className="node-grid">{places.map((place) => <button key={place.id} type="button" onClick={() => go(place.id)}><span>{place.map_index}</span><div><b>{place.short_name ?? place.name}</b><small>{placeType(place)} · {place.node_type === "accommodation_area" ? stayFit(place) : duration(place)}</small></div><i>→</i></button>)}</section>}
    {layer !== "attractions" && <LayerWorkspace layer={layer} hasData={places.length > 0} count={places.length} />}
  </main>;
}

function LayerWorkspace({ layer, hasData, count }: { layer: Exclude<CityLayer, "attractions">; hasData: boolean; count: number }) {
  const food = layer === "food";
  const cards = food ? [
    ["01", "美食区域", "带坐标的主地图节点；保存适合时段、人均区间、排队风险与主打菜。"],
    ["02", "菜品与代表店铺", "作为美食区域的子节点进入详情，不在城市总图重复堆叠。"],
    ["03", "景点参照层", "景点只作为灰色空间参照；接入高德后动态计算实际步行与驾车时间。"],
  ] : [
    ["01", `${count} 个住宿区域`, "以区域而非单家酒店为主节点，保存适合人群、价格风险、噪声与环境特征。"],
    ["02", "景点与车站锚点", "住宿区与景点均可在页面上方通勤查询器中选择，避免固化点对点距离。"],
    ["03", "高德动态计算", "路线 API 已接入；酒店库存、当日价格和房型仍由预订平台临行查询。"],
  ];
  return <section className="layer-workspace"><div className="workspace-head"><div><p className="section-kicker">{food ? "FOOD DATA CONTRACT" : "ACCOMMODATION DATA CONTRACT"}</p><h2>{hasData ? "图层数据已接入" : "结构已就绪，等待数据集"}</h2></div><span>{food ? "橙色主节点 + 灰色景点参照" : "住宿区域 + 景点参照 + 动态通勤"}</span></div><div className="workspace-grid">{cards.map(([index, title, description]) => <article key={index}><span>{index}</span><h3>{title}</h3><p>{description}</p></article>)}</div>{!food && hasData && <div className="future-form" aria-label="住宿数据接入状态"><div><small>区域数据库</small><b>{count} 个区域节点已接入</b></div><div><small>通勤查询</small><b>使用页面上方高德查询器</b></div><div><small>酒店价格 / 库存</small><b>保持动态，不写入本地 JSON</b></div><button type="button">高德路线 API · 已连接</button></div>}</section>;
}

type LocatedNode = TravelNode & { location: Location & { latitude: number; longitude: number } };
type GeoBounds = { minLat: number; maxLat: number; minLon: number; maxLon: number };

function geoDistance(a: LocatedNode, b: LocatedNode) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const lat1 = toRadians(a.location.latitude), lat2 = toRadians(b.location.latitude);
  const deltaLat = lat2 - lat1, deltaLon = toRadians(b.location.longitude - a.location.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function boundsFor(nodes: LocatedNode[], padding = .16): GeoBounds {
  const lats = nodes.map((node) => node.location.latitude), lons = nodes.map((node) => node.location.longitude);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const latSpan = Math.max(maxLat - minLat, .012), lonSpan = Math.max(maxLon - minLon, .012);
  minLat -= latSpan * padding; maxLat += latSpan * padding; minLon -= lonSpan * padding; maxLon += lonSpan * padding;
  return { minLat, maxLat, minLon, maxLon };
}

function projectNode(node: LocatedNode, bounds: GeoBounds, xRange = 86) {
  return {
    place: node,
    x: 7 + (node.location.longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon) * xRange,
    y: 7 + (bounds.maxLat - node.location.latitude) / (bounds.maxLat - bounds.minLat) * 86,
  };
}

function scaleFor(bounds: GeoBounds, xRange = 86) {
  const midLat = (bounds.minLat + bounds.maxLat) / 2 * Math.PI / 180;
  const spanKm = (bounds.maxLon - bounds.minLon) * 111.32 * Math.cos(midLat);
  const choices = [.2, .5, 1, 2, 5, 10, 20, 50, 100];
  const km = [...choices].reverse().find((choice) => choice <= spanKm * .28) ?? .2;
  return { km, width: Math.min(42, km / spanKm * xRange) };
}

function CityNodeMap({ city, places, referencePlaces = [], selected, onSelect, waterLabel, mode = "attractions" }: { city: City; places: TravelNode[]; referencePlaces?: TravelNode[]; selected?: TravelNode; onSelect: (id: string) => void; waterLabel?: string; mode?: CityLayer | "reference" }) {
  const layout = useMemo(() => {
    const located = places.filter((place): place is LocatedNode => typeof place.location?.latitude === "number" && typeof place.location?.longitude === "number");
    const references = referencePlaces.filter((place): place is LocatedNode => typeof place.location?.latitude === "number" && typeof place.location?.longitude === "number");
    if (!located.length) return null;
    const center = located.reduce((best, candidate) => {
      const total = located.reduce((sum, place) => sum + geoDistance(candidate, place), 0);
      return total < best.total ? { node: candidate, total } : best;
    }, { node: located[0], total: Number.POSITIVE_INFINITY });
    const ranked = located.map((place) => ({ place, distance: geoDistance(center.node, place) })).sort((a, b) => a.distance - b.distance);
    let split = ranked.length;
    let largestRatio = 1;
    for (let index = 1; index < ranked.length; index++) {
      const ratio = ranked[index].distance / Math.max(ranked[index - 1].distance, .8);
      if (ratio > largestRatio) { largestRatio = ratio; split = index; }
    }
    const core = largestRatio >= 2.5 && split >= 3 ? ranked.slice(0, split).map((item) => item.place) : located;
    const remote = located.filter((place) => !core.includes(place));
    const coreBounds = boundsFor(core, .24), overviewBounds = boundsFor([...located, ...references], .12);
    const focusPins = core.map((place) => projectNode(place, coreBounds, 58));
    const overviewPins = located.map((place) => projectNode(place, overviewBounds));
    const referenceFocusPins = references.filter((place) => place.location.latitude >= coreBounds.minLat && place.location.latitude <= coreBounds.maxLat && place.location.longitude >= coreBounds.minLon && place.location.longitude <= coreBounds.maxLon).map((place) => projectNode(place, coreBounds, 58));
    const referenceOverviewPins = references.map((place) => projectNode(place, overviewBounds));
    const left = 7 + (coreBounds.minLon - overviewBounds.minLon) / (overviewBounds.maxLon - overviewBounds.minLon) * 86;
    const right = 7 + (coreBounds.maxLon - overviewBounds.minLon) / (overviewBounds.maxLon - overviewBounds.minLon) * 86;
    const top = 7 + (overviewBounds.maxLat - coreBounds.maxLat) / (overviewBounds.maxLat - overviewBounds.minLat) * 86;
    const bottom = 7 + (overviewBounds.maxLat - coreBounds.minLat) / (overviewBounds.maxLat - overviewBounds.minLat) * 86;
    return { center: center.node, core, remote, focusPins, overviewPins, referenceFocusPins, referenceOverviewPins, coreFrame: { left, top, width: right - left, height: bottom - top }, focusScale: scaleFor(coreBounds, 58), overviewScale: scaleFor(overviewBounds) };
  }, [places, referencePlaces]);

  if (!layout) return <div className="map-shell map-empty">城市坐标待补充</div>;
  const remoteDistance = layout.remote.length ? Math.round(Math.max(...layout.remote.map((place) => geoDistance(layout.center, place)))) : 0;
  const mapTitle = mode === "food" ? "美食区域 · 景点参照" : mode === "accommodation" ? "住宿区域 · 景点参照" : mode === "reference" ? "景点参照层 · 等待数据" : "核心区局部放大";
  const referenceMode = mode === "reference";
  return <div className={`map-shell city-map-shell map-mode-${mode}`}><div className="map-head"><div><span className="live-dot" />{mapTitle}</div><span>高德 GCJ‑02 · 双层比例</span></div><div className="map-canvas focus-map">
    {waterLabel && <div className="river"><span>{waterLabel}</span></div>}<div className="north">N<br /><span>↑</span></div><div className="city-label">{city.name}<br />核心区</div>
    {layout.referenceFocusPins.map(({ place, x, y }) => <span key={`ref-${place.id}`} className="reference-map-pin" style={{ left: `${x}%`, top: `${y}%` }}><i /><em>{place.short_name ?? place.name}</em></span>)}
    {layout.focusPins.map(({ place, x, y }) => referenceMode
      ? <span key={place.id} className="reference-map-pin" style={{ left: `${x}%`, top: `${y}%` }}><i /><em>{place.short_name ?? place.name}</em></span>
      : <button type="button" key={place.id} className={`map-pin ${mode === "food" ? "is-food" : mode === "accommodation" ? "is-stay" : ""} ${selected?.id === place.id ? "is-active" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => onSelect(place.id)} aria-label={`选择${place.name}`}><span>{place.map_index}</span><em>{place.short_name ?? place.name}</em></button>)}
    <MapScale scale={layout.focusScale} label="核心区比例尺" />
    <aside className="overview-inset" aria-label={`${city.name}全域概览`}><div className="inset-head"><b>全域概览</b><span>{referenceMode ? "景点参照" : layout.remote.length ? `${layout.remote.length} 个远郊节点` : "全部节点"}</span></div><div className="inset-map">
      <div className="core-frame" style={{ left: `${layout.coreFrame.left}%`, top: `${layout.coreFrame.top}%`, width: `${layout.coreFrame.width}%`, height: `${layout.coreFrame.height}%` }}><span>主图范围</span></div>
      {layout.referenceOverviewPins.map(({ place, x, y }) => <span key={`overview-ref-${place.id}`} className="overview-pin is-reference" style={{ left: `${x}%`, top: `${y}%` }}><i /></span>)}
      {layout.overviewPins.map(({ place, x, y }) => referenceMode
        ? <span key={place.id} className="overview-pin is-reference" style={{ left: `${x}%`, top: `${y}%` }}><i />{layout.remote.includes(place) && <em>{place.short_name ?? place.name}</em>}</span>
        : <button type="button" key={place.id} className={`overview-pin ${mode === "food" ? "is-food" : mode === "accommodation" ? "is-stay" : ""} ${layout.remote.includes(place) ? "is-remote" : ""} ${selected?.id === place.id ? "is-active" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => onSelect(place.id)} aria-label={`在全域图选择${place.name}`}><i />{layout.remote.includes(place) && <em>{place.short_name ?? place.name}</em>}</button>)}
      <MapScale scale={layout.overviewScale} compact label="全域比例尺" />
    </div>{referenceMode ? <p>灰色节点仅用于辅助定位，等待主图层数据接入</p> : remoteDistance > 0 && <p>最远节点与核心区约 {remoteDistance} km 直线跨度</p>}</aside>
  </div>{selected && <div className="map-selection"><div><p>{placeType(selected)} · {selected.node_type === "accommodation_area" ? stayFit(selected) : duration(selected)}{layout.remote.includes(selected as LocatedNode) ? " · 远郊节点" : " · 核心区节点"}</p><h2>{selected.short_name ?? selected.name}</h2><span>{lead(selected)}</span></div><button type="button" className="detail-button" onClick={() => go(selected.id)}>进入攻略 <span>↗</span></button></div>}</div>;
}

function MapScale({ scale, compact = false, label }: { scale: { km: number; width: number }; compact?: boolean; label: string }) {
  return <div className={compact ? "map-scale is-compact" : "map-scale"} aria-label={`${label} ${scale.km}公里`}><i style={{ width: `${scale.width}%` }} /><span>{scale.km < 1 ? `${scale.km * 1000} m` : `${scale.km} km`}</span></div>;
}

function CityFramework({ city }: { city: City }) {
  const links = atlas.transports.filter((transport) => transport.from_city_id === city.id || transport.to_city_id === city.id);
  return <main className="framework-page"><SiteHeader compact /><section className="framework-hero"><p className="eyebrow">CITY NODE · FRAMEWORK READY</p><h1>{city.name}</h1><p>{city.journey_role} · {city.province}</p><div className="framework-badge">城市详情节点待下一阶段完善</div></section><section className="framework-grid"><article><span>空间锚点</span><h2>{city.location?.map_anchor}</h2><p>{city.location?.latitude}, {city.location?.longitude} · GCJ‑02</p></article><article><span>铁路连接</span><h2>{links.length} 条</h2><p>{links.map((link) => link.name).join(" · ")}</p></article><article><span>数据状态</span><h2>框架已建立</h2><p>景点、博物馆、美食、住宿与市内交通将在城市阶段分别建档。</p></article></section><section className="framework-routes">{links.map((transport) => <TransportCard key={transport.id} transport={transport} />)}</section><button type="button" className="return-button" onClick={() => go("overview")}>返回旅行总地图</button></main>;
}

function PlaceDetail({ place, cityName, onBack }: { place: TravelNode; cityName: string; onBack: () => void }) {
  const official = object(place.official_info), experience = object(place.experience), experienceLayer = object(place.experience_layer), holidayReference = object(place.holiday_reference);
  const isFood = place.node_type === "food";
  const isStay = place.node_type === "accommodation_area";
  const groupedChildren = new Map<string, TravelNode[]>(); for (const child of place.children ?? []) { const group = child.node_type === "food" ? `food_${child.food_scope ?? "restaurant"}` : child.node_type; groupedChildren.set(group, [...(groupedChildren.get(group) ?? []), child]); }
  const bestFor = [...(place.suitable_for ?? []), ...strings(experience.best_for), ...strings(experience.best_time), ...strings(experienceLayer.experience_type)];
  const positives = contents(experienceLayer.positive), highlights = positives.length ? positives : strings(experience.highlights), avoids = contents(experienceLayer.avoid).length ? contents(experienceLayer.avoid) : strings(experience.avoid);
  const visitTips = strings(experienceLayer.visit_tips), photoScenes = strings(object(experienceLayer.photo_info).recommended_scene), crowd = Object.keys(object(experienceLayer.crowd_model)).length ? object(experienceLayer.crowd_model) : object(experience.crowd), confidence = object(experienceLayer.confidence);
  return <main className="detail-page"><header className="detail-nav"><button type="button" onClick={onBack}>← 返回{cityName}地图</button><span>{place.map_index} · {placeType(place)}</span></header><article>
    <section className="detail-hero"><p className="eyebrow">{place.city} · {place.category?.join(" / ")}</p><h1>{place.name}</h1><p className="detail-lead">{lead(place)}</p><div className="tag-row">{place.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div></section>
    <section className="quick-grid">{isFood ? <><Fact label="建议停留" value={duration(place)} /><Fact label="适合时段" value={foodPeriods(place)} /><Fact label="价格参考" value={foodPrice(place)} /><Fact label="候选子节点" value={`${place.children?.length ?? 0} 个`} /></> : isStay ? <><Fact label="地图锚点" value={place.location?.map_anchor ?? "待核验"} /><Fact label="适合" value={stayFit(place)} /><Fact label="公共交通" value={string(object(place.transit_profile).public_transport) ?? "待核验"} /><Fact label="假日涨价风险" value={stayRisk(experience.holiday_price_risk)} /></> : <><Fact label="建议时长" value={duration(place)} /><Fact label="开放时间" value={openingText(place)} /><Fact label="门票" value={ticketText(place)} /><Fact label="预约" value={reservationText(place)} /></>}</section>
    <section className="notice"><b>{isFood || isStay ? "数据提示" : "国庆提示"}</b><span>{isFood ? "店铺、价格和推荐菜来自游客截图与第三方目录快照，尚未完成逐店人工核验；营业状态和排队情况请通过高德动态确认。" : isStay ? "住宿区是旅行决策范围，不是行政边界；具体酒店库存、房价、房型与真实通勤必须在预订时动态核验。" : Object.keys(holidayReference).length ? "2026 年专项公告尚未发布；下方 2025 年资料只用于预估预约、客流和开放趋势，不能视为 2026 执行规则。" : "2026 年国庆专项开放、限流及放票安排尚未发布；出发前需再次查询官方公告。"}</span></section>
    {!isFood && !isStay && Object.keys(holidayReference).length > 0 && <HolidayReference reference={holidayReference} />}
    {!isFood && !isStay && Object.keys(object(place.remote_transport_profile)).length > 0 && <RemoteTransport profile={object(place.remote_transport_profile)} />}
    <section className="content-grid"><div className="content-block official-block"><p className="section-kicker">{isFood || isStay ? "LOCATION LAYER" : "OFFICIAL LAYER"}</p><h2>{isFood ? "位置与目录信息" : isStay ? "空间锚点与交通" : "官方信息"}</h2><dl><div><dt>{isStay ? "检索范围" : "地址"}</dt><dd>{place.location?.address ?? "地址待核验"}</dd></div><div><dt>坐标</dt><dd>{place.location?.latitude}, {place.location?.longitude} · {place.location?.coordinate_system}</dd></div>{place.location?.amap_poi_id && <div><dt>高德 POI</dt><dd><a href={`https://ditu.amap.com/place/${place.location.amap_poi_id}`} target="_blank" rel="noreferrer">{place.location.amap_poi_id} ↗</a></dd></div>}<div><dt>{isFood ? "资料状态" : isStay ? "车站接驳" : "预约渠道"}</dt><dd>{isFood ? string(official.status) ?? "待核验" : isStay ? string(object(place.transit_profile).rail_station_access) ?? "动态核验" : strings(place.reservation?.channels).join("、") || "以官方公告为准"}</dd></div>{isStay && <div><dt>步行特征</dt><dd>{string(object(place.transit_profile).walkability) ?? "动态核验"}</dd></div>}</dl></div>
      <div className="content-block experience-block"><p className="section-kicker">EXPERIENCE LAYER</p><h2>{isStay ? "住宿决策经验" : "实际体验"}</h2><div className="experience-provenance"><b>游客经验 · {stayRisk(confidence.overall)}</b><span>{strings(experienceLayer.source).join(" · ")}</span></div>{highlights.length > 0 && <InfoList title="高频正向反馈" items={highlights} />}{bestFor.length > 0 && <InfoList title={isStay ? "适合人群" : "适合谁 / 何时去"} items={bestFor} />}{visitTips.length > 0 && <InfoList title={isStay ? "订房与选址建议" : "参观建议"} items={visitTips} />}{photoScenes.length > 0 && <InfoList title="推荐拍摄场景" items={photoScenes} />}<InfoList title={isStay ? "区域客流模型" : "人流模型"} items={[`工作日：${stayRisk(crowd.weekday ?? crowd.normal)}`, `周末：${stayRisk(crowd.weekend)}`, `国庆：${stayRisk(crowd.national_holiday ?? crowd.holiday)}`]} />{avoids.length > 0 && <InfoList title="避坑" items={avoids} warning />}</div></section>
    <section className="score-section"><div><p className="section-kicker">AI SCORE · 1—5</p><h2>这处节点适合什么需求？</h2></div><div className="score-grid">{Object.entries(place.ai_score ?? {}).map(([key, value]) => <Score key={key} label={scoreLabels[key] ?? key} value={value} />)}</div></section>
    {[...groupedChildren.entries()].map(([type, children]) => <section className="children-section" key={type}><div className="section-title"><p className="section-kicker">DEEP NODES</p><h2>{sectionLabels[type] ?? type}</h2><span>{children.length} 个节点</span></div><div className="child-grid">{children.map((child) => <article className="child-card" key={child.id}><small>{child.node_type === "food" ? child.food_scope : child.node_type.replaceAll("_", " ")}</small><h3>{child.name}</h3><p>{childDescription(child)}</p><div>{child.tags?.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div></article>)}</div></section>)}
    <section className="sources-section"><p className="section-kicker">SOURCES</p><h2>资料来源与核验</h2><div>{place.sources?.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><b>{source.name}</b><span>{source.scope?.join(" · ")}</span><i>↗</i></a>)}</div></section>
  </article><footer>数据核验日期：{string(object(place.metadata).last_verified_at) ?? "待核验"} · 动态信息请以官方当日公告为准</footer></main>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="fact"><small>{label}</small><b>{value}</b></div>; }
function InfoList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) { return <div className={warning ? "info-list warning" : "info-list"}><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
function Score({ label, value }: { label: string; value: number | null }) { return <div className="score"><div><span>{label}</span><b>{value ?? "—"}</b></div><i><em style={{ width: `${(value ?? 0) * 20}%` }} /></i></div>; }
function HolidayReference({ reference }: { reference: JsonObject }) {
  const facts = object(reference.observed_facts), planning = strings(reference.planning_inference), sources = Array.isArray(reference.sources) ? reference.sources.map(object) : [];
  const year = number(reference.reference_year) ?? 2025, target = number(reference.target_year) ?? 2026;
  return <section className="holiday-reference"><div className="holiday-reference-head"><div><p className="section-kicker">HISTORICAL HOLIDAY REFERENCE</p><h2>{year} 年国庆参考</h2></div><span>仅辅助 {target} 年规划</span></div>
    <div className="holiday-reference-grid"><div><h3>往年已确认事实</h3><dl>{Object.entries(facts).map(([key, value]) => <div key={key}><dt>{holidayFactLabels[key] ?? key}</dt><dd>{holidayFactValue(value)}</dd></div>)}</dl></div><div><h3>规划器可采用的推断</h3><ul>{planning.map((item) => <li key={item}>{item}</li>)}</ul><p className="holiday-warning">{string(reference.warning)}</p></div></div>
    <div className="holiday-reference-sources">{sources.map((source) => <a key={string(source.url)} href={string(source.url) ?? "#"} target="_blank" rel="noreferrer">{string(source.name)} ↗</a>)}</div>
  </section>;
}

function RemoteTransport({ profile }: { profile: JsonObject }) {
  const services = Array.isArray(profile.public_transport) ? profile.public_transport.map(object) : [];
  const pairing = object(profile.same_day_pairing), selfDrive = object(profile.self_drive);
  const serviceLines = services.map((service) => [string(service.from), string(service.mode), string(service.notes)].filter(Boolean).join(" · ")).filter(Boolean);
  const riskItems = [...strings(profile.holiday_risk), ...strings(selfDrive.risk)];
  return <section className="holiday-reference remote-transport"><div className="holiday-reference-head"><div><p className="section-kicker">REMOTE TRANSPORT PROFILE</p><h2>偏远景点交通画像</h2></div><span>实时算路 + 经验约束</span></div>
    <div className="holiday-reference-grid"><div><h3>如何抵达</h3><InfoList title="主要枢纽" items={strings(profile.primary_hubs)} />{serviceLines.length > 0 && <InfoList title="公共交通" items={serviceLines} />}<InfoList title="末端与返程" items={[string(profile.last_mile), string(profile.return_risk) ? `返程风险：${string(profile.return_risk)}` : null].filter((item): item is string => Boolean(item))} /></div>
      <div><h3>排程约束</h3>{strings(pairing.recommended).length > 0 && <InfoList title="可考虑同日" items={strings(pairing.recommended)} />}{strings(pairing.avoid).length > 0 && <InfoList title="不建议同日" items={strings(pairing.avoid)} warning />}{riskItems.length > 0 && <InfoList title="节假日与自驾风险" items={riskItems} warning />}<InfoList title="出发前动态复核" items={strings(profile.dynamic_checks)} /></div></div>
  </section>;
}
