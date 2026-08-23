"use client";

import { useEffect, useMemo, useState } from "react";
import placesData from "../generated/places.json";

type JsonObject = Record<string, unknown>;
type Source = { name: string; url: string; scope?: string[] };
type TravelNode = {
  id: string;
  name: string;
  short_name?: string;
  city?: string;
  node_type: string;
  map_index?: string;
  category?: string[];
  tags?: string[];
  location?: { address?: string; latitude?: number; longitude?: number; coordinate_system?: string; amap_poi_id?: string };
  official_info?: JsonObject;
  reservation?: JsonObject;
  experience?: JsonObject;
  experience_layer?: JsonObject;
  ai_score?: Record<string, number | null>;
  duration?: { recommended_minutes?: number; minimum_minutes?: number; maximum_minutes?: number };
  children?: TravelNode[];
  sources?: Source[];
  metadata?: JsonObject;
};

const places = placesData as unknown as TravelNode[];
const scoreLabels: Record<string, string> = { history: "历史", photo: "拍照", family: "亲子", rain_day: "雨天", crowd_risk: "拥挤风险", first_visit: "首次到访" };
const sectionLabels: Record<string, string> = {
  permanent_exhibition: "常设展陈",
  temporary_exhibition: "临时展览",
  artifact: "精品文物",
  collection_group: "藏品专题",
  history_event: "历史事件",
  historic_site: "关联旧址",
};

function object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
function string(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function number(value: unknown): number | null { return typeof value === "number" ? value : null; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function contents(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => string(object(item).content)).filter((item): item is string => Boolean(item));
}
function duration(place: TravelNode): string {
  const min = place.duration?.minimum_minutes;
  const max = place.duration?.maximum_minutes;
  if (!min || !max) return "时长待补充";
  const format = (minutes: number) => minutes % 60 ? `${Math.floor(minutes / 60)}小时${minutes % 60}分` : `${minutes / 60}小时`;
  return `${format(min)}–${format(max)}`;
}
function placeType(place: TravelNode): string {
  if (place.node_type === "museum") return "文明通史";
  if (place.node_type === "memorial") return "革命旧址";
  return "江南名楼";
}
function lead(place: TravelNode): string {
  const official = object(place.official_info);
  return string(official.description) ?? string(official.positioning) ?? strings(object(place.experience).highlights).join("、");
}
function openingText(place: TravelNode): string {
  return string(object(object(place.official_info).opening_hours).regular_schedule) ?? "开放时间等待官方核验";
}
function ticketText(place: TravelNode): string {
  const ticket = object(object(place.official_info).ticket);
  const amount = number(object(ticket.general_admission).amount) ?? number(ticket.price);
  return amount === 0 ? "免费开放" : amount ? `¥${amount}` : "票价动态维护";
}
function reservationText(place: TravelNode): string {
  if (!place.reservation) return "以官方公告为准";
  const required = place.reservation.required === true ? "须实名预约" : place.reservation.required === false ? "无需预约" : "预约规则待核验";
  const days = number(place.reservation.advance_days);
  return days ? `${required} · 可提前 ${days} 天` : required;
}
function childDescription(child: TravelNode): string {
  const official = object(child.official_info);
  return string(official.description) ?? string(official.theme) ?? ([string(official.period), string(official.category), string(official.site_type)].filter(Boolean).join(" · ") || "详细内容持续核验中");
}

export function MapExplorer() {
  const [selectedId, setSelectedId] = useState(places[0].id);
  const [detailId, setDetailId] = useState<string | null>(null);
  const selected = places.find((place) => place.id === selectedId) ?? places[0];
  const detail = detailId ? places.find((place) => place.id === detailId) ?? null : null;

  useEffect(() => {
    const syncHash = () => {
      const id = window.location.hash.slice(1);
      if (places.some((place) => place.id === id)) { setSelectedId(id); setDetailId(id); }
      else setDetailId(null);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const pins = useMemo(() => {
    const located = places.filter((place) => place.location?.latitude && place.location?.longitude);
    const lats = located.map((place) => place.location!.latitude!);
    const lons = located.map((place) => place.location!.longitude!);
    const minLat = Math.min(...lats) - 0.005;
    const maxLat = Math.max(...lats) + 0.005;
    const minLon = Math.min(...lons) - 0.005;
    const maxLon = Math.max(...lons) + 0.005;
    return located.map((place) => ({
      place,
      x: 12 + ((place.location!.longitude! - minLon) / (maxLon - minLon)) * 76,
      y: 8 + ((maxLat - place.location!.latitude!) / (maxLat - minLat)) * 84,
    }));
  }, []);

  const showDetail = (place: TravelNode) => { setSelectedId(place.id); window.location.hash = place.id; };
  const closeDetail = () => { window.history.pushState(null, "", window.location.pathname + window.location.search); setDetailId(null); };

  if (detail) return <PlaceDetail place={detail} onBack={closeDetail} />;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="赣行志首页"><span className="brand-mark">赣</span><span>赣行志</span></a>
        <span className="edition">2026 · 国庆先行版</span>
      </header>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">NANCHANG · CULTURE ATLAS</p>
          <h1>三处坐标，<br />读懂一座英雄城。</h1>
          <p className="intro">不是一条被写死的路线，而是一张可以继续生长的旅行知识地图。</p>
          <div className="hero-meta"><span><b>{places.length}</b> 个精选节点</span><span><b>19</b> 个结构化节点</span></div>
        </div>
        <div className="map-shell" aria-label="南昌三处景点空间关系图">
          <div className="map-head"><div><span className="live-dot" />真实空间关系</div><span>高德 GCJ‑02</span></div>
          <div className="map-canvas">
            <div className="river"><span>赣 江</span></div><div className="north">N<br /><span>↑</span></div><div className="city-label">南昌<br />老城</div>
            {pins.map(({ place, x, y }) => (
              <button type="button" key={place.id} className={`map-pin ${selected.id === place.id ? "is-active" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => setSelectedId(place.id)} aria-label={`查看${place.name}`}>
                <span>{place.map_index}</span><em>{place.short_name ?? place.name}</em>
              </button>
            ))}
          </div>
          <div className="map-selection">
            <div><p>{placeType(selected)} · {duration(selected)}</p><h2>{selected.short_name ?? selected.name}</h2><span>{lead(selected)}</span></div>
            <button type="button" className="detail-button" onClick={() => showDetail(selected)}>进入攻略 <span>↗</span></button>
          </div>
        </div>
      </section>
      <section className="place-strip" aria-label="景点概览">
        {places.map((place) => (
          <button key={place.id} type="button" onClick={() => showDetail(place)}><span>{place.map_index}</span><div><b>{place.short_name ?? place.name}</b><small>{placeType(place)}</small></div><i>→</i></button>
        ))}
      </section>
    </main>
  );
}

function PlaceDetail({ place, onBack }: { place: TravelNode; onBack: () => void }) {
  const official = object(place.official_info);
  const experience = object(place.experience);
  const experienceLayer = object(place.experience_layer);
  const groupedChildren = new Map<string, TravelNode[]>();
  for (const child of place.children ?? []) groupedChildren.set(child.node_type, [...(groupedChildren.get(child.node_type) ?? []), child]);
  const childGroups = [...groupedChildren.entries()];
  const bestFor = [...strings(experience.best_for), ...strings(experience.best_time), ...strings(experienceLayer.experience_type)];
  const positives = contents(experienceLayer.positive);
  const highlights = positives.length ? positives : strings(experience.highlights);
  const avoids = contents(experienceLayer.avoid).length ? contents(experienceLayer.avoid) : strings(experience.avoid);
  const visitTips = strings(experienceLayer.visit_tips);
  const photoScenes = strings(object(experienceLayer.photo_info).recommended_scene);
  const crowd = Object.keys(object(experienceLayer.crowd_model)).length ? object(experienceLayer.crowd_model) : object(experience.crowd);
  const confidence = object(experienceLayer.confidence);
  const experienceSources = strings(experienceLayer.source);
  const aiNote = string(experienceLayer.ai_note);
  const phone = string(official.contact_phone);

  return (
    <main className="detail-page">
      <header className="detail-nav">
        <button type="button" onClick={onBack}>← 返回地图</button>
        <span>{place.map_index} / 03 · {placeType(place)}</span>
      </header>
      <article>
        <section className="detail-hero">
          <p className="eyebrow">{place.city} · {place.category?.join(" / ")}</p>
          <h1>{place.name}</h1>
          <p className="detail-lead">{lead(place)}</p>
          <div className="tag-row">{place.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </section>

        <section className="quick-grid">
          <Fact label="建议时长" value={duration(place)} />
          <Fact label="开放时间" value={openingText(place)} />
          <Fact label="门票" value={ticketText(place)} />
          <Fact label="预约" value={reservationText(place)} />
        </section>

        <section className="notice"><b>国庆提示</b><span>2026 年国庆专项开放、限流及放票安排尚未发布；出发前需再次查询官方公告。</span></section>

        <section className="content-grid">
          <div className="content-block official-block">
            <p className="section-kicker">OFFICIAL LAYER</p><h2>官方信息</h2>
            <dl>
              <div><dt>地址</dt><dd>{place.location?.address}</dd></div>
              <div><dt>坐标</dt><dd>{place.location?.latitude}, {place.location?.longitude} · {place.location?.coordinate_system}</dd></div>
              <div><dt>高德 POI</dt><dd><a href={`https://ditu.amap.com/place/${place.location?.amap_poi_id}`} target="_blank" rel="noreferrer">{place.location?.amap_poi_id} ↗</a></dd></div>
              {phone && <div><dt>咨询电话</dt><dd>{phone}</dd></div>}
              <div><dt>预约渠道</dt><dd>{strings(place.reservation?.channels).join("、") || "以官方公告为准"}</dd></div>
            </dl>
          </div>
          <div className="content-block experience-block">
            <p className="section-kicker">EXPERIENCE LAYER</p><h2>实际体验</h2>
            <div className="experience-provenance"><b>游客经验 · {string(confidence.overall) ?? "置信度待评估"}</b><span>{experienceSources.join(" · ")}</span>{string(confidence.reason) && <small>{string(confidence.reason)}</small>}</div>
            {highlights.length > 0 && <InfoList title="高频正向反馈" items={highlights} />}
            {bestFor.length > 0 && <InfoList title="适合谁 / 何时去" items={bestFor} />}
            {visitTips.length > 0 && <InfoList title="参观建议" items={visitTips} />}
            {photoScenes.length > 0 && <InfoList title="推荐拍摄场景" items={photoScenes} />}
            <InfoList title="人流模型" items={[`工作日：${string(crowd.weekday) ?? string(crowd.normal) ?? "待补充"}`, `周末：${string(crowd.weekend) ?? "待补充"}`, `国庆：${string(crowd.national_holiday) ?? string(crowd.holiday) ?? "待补充"}`, ...strings(crowd.peak_time).map((time) => `高峰：${time}`)]} />
            {avoids.length > 0 && <InfoList title="避坑" items={avoids} warning />}
          </div>
        </section>

        <section className="score-section">
          <div><p className="section-kicker">AI SCORE · 1—5</p><h2>这处节点适合什么需求？</h2></div>
          <div className="score-grid">{Object.entries(place.ai_score ?? {}).map(([key, value]) => <Score key={key} label={scoreLabels[key] ?? key} value={value} />)}</div>
        </section>
        {aiNote && <section className="ai-note"><span>AI ROUTING NOTE</span><p>{aiNote}</p></section>}

        {childGroups.map(([type, children]) => (
          <section className="children-section" key={type}>
            <div className="section-title"><p className="section-kicker">DEEP NODES</p><h2>{sectionLabels[type] ?? type}</h2><span>{children?.length ?? 0} 个节点</span></div>
            <div className="child-grid">{children?.map((child) => {
              const importance = number(object(child.experience).importance);
              return <article className="child-card" key={child.id}><small>{child.node_type.replaceAll("_", " ")}</small><h3>{child.name}</h3><p>{childDescription(child)}</p>{importance && <b>重要度 {importance}/5</b>}<div>{child.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div></article>;
            })}</div>
          </section>
        ))}

        <section className="sources-section">
          <p className="section-kicker">SOURCES</p><h2>资料来源与核验</h2>
          <div>{place.sources?.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><b>{source.name}</b><span>{source.scope?.join(" · ")}</span><i>↗</i></a>)}</div>
        </section>
      </article>
      <footer>数据核验日期：{string(object(place.metadata).last_verified_at) ?? "待核验"} · 动态信息请以官方当日公告为准</footer>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="fact"><small>{label}</small><b>{value}</b></div>; }
function InfoList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) { return <div className={warning ? "info-list warning" : "info-list"}><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
function Score({ label, value }: { label: string; value: number | null }) { return <div className="score"><div><span>{label}</span><b>{value ?? "—"}</b></div><i><em style={{ width: `${(value ?? 0) * 20}%` }} /></i></div>; }
