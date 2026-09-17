"use client";

import { type ComponentType, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BarChart3, BedDouble, BookOpen, Brain, BriefcaseBusiness,
  BusFront, CalendarDays, Check, ChevronRight, Clock3, Dumbbell, Home as HomeIcon,
  Pencil, Plus, Sparkles, Target, TimerReset, Trash2, UsersRound, Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

type Category = "deep" | "normal" | "meeting" | "learning" | "gym" | "food" | "chores" | "commute" | "free" | "sleep";
type Entry = { text: string; category: Category; start: string; end: string; blockId?: string; rangeStart?: string; rangeEnd?: string };
type DayLog = { intention: string; reflection: string; entries: Record<number, Entry> };
type CategoryMeta = { label: string; score: number; color: string; tint: string; Icon: ComponentType<{ className?: string }> };

const EMPTY_DAY: DayLog = { intention: "", reflection: "", entries: {} };
const categories: Record<Category, CategoryMeta> = {
  deep: { label: "Deep work", score: 1, color: "#b9f36a", tint: "#efffd9", Icon: Brain },
  normal: { label: "Normal work", score: .75, color: "#67d8ff", tint: "#def7ff", Icon: BriefcaseBusiness },
  meeting: { label: "Meetings", score: .6, color: "#9f8cff", tint: "#ece8ff", Icon: UsersRound },
  learning: { label: "Learning", score: .9, color: "#ffca62", tint: "#fff3d6", Icon: BookOpen },
  gym: { label: "Gym / workout", score: .75, color: "#ff7898", tint: "#ffe3ea", Icon: Dumbbell },
  food: { label: "Food", score: .2, color: "#ff9f66", tint: "#ffeadc", Icon: Utensils },
  chores: { label: "Chores", score: .4, color: "#7ad7b3", tint: "#ddf7ed", Icon: HomeIcon },
  commute: { label: "Commute", score: .25, color: "#6ea6ff", tint: "#e1ecff", Icon: BusFront },
  free: { label: "Free time", score: .1, color: "#d18cff", tint: "#f4e4ff", Icon: Sparkles },
  sleep: { label: "Sleep", score: 0, color: "#77809f", tint: "#e8eaf1", Icon: BedDouble },
};

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const defaultTimes = (hour: number) => ({ start: `${pad(hour)}:00`, end: `${pad((hour + 1) % 24)}:00` });
const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
const durationHours = (entry: Entry) => { let value = minutes(entry.end) - minutes(entry.start); if (value <= 0) value += 1440; return value / 60; };
const timeFromMinutes = (value: number) => { const normalized = ((value % 1440) + 1440) % 1440; return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`; };
const coveredSlotCount = (start: string, end: string) => { const startMinute = minutes(start); let endMinute = minutes(end); if (endMinute <= startMinute) endMinute += 1440; return Math.ceil(endMinute / 60) - Math.floor(startMinute / 60); };
function buildSegments(text: string, category: Category, start: string, end: string, blockId: string) {
  const segments: Record<number, Entry> = {};
  const startMinute = minutes(start); let endMinute = minutes(end); if (endMinute <= startMinute) endMinute += 1440;
  for (let cursor = Math.floor(startMinute / 60) * 60; cursor < endMinute; cursor += 60) {
    const slot = Math.floor(cursor / 60) % 24;
    segments[slot] = { text, category, start: timeFromMinutes(Math.max(startMinute, cursor)), end: timeFromMinutes(Math.min(endMinute, cursor + 60)), blockId, rangeStart: start, rangeEnd: end };
  }
  return segments;
}
const displayTime = (time: string) => { const [h, m] = time.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`; };
const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);
const legacyCategory = (value: string): Category => ({ focus: "deep", progress: "normal", maintenance: "chores", recharge: "free" }[value] as Category) || (value in categories ? value as Category : "normal");

function normalizeDay(raw: unknown): DayLog {
  if (!raw || typeof raw !== "object") return EMPTY_DAY;
  const value = raw as Partial<DayLog>;
  const entries: Record<number, Entry> = {};
  Object.entries(value.entries ?? {}).forEach(([slot, candidate]) => {
    const hour = Number(slot); const old = candidate as Partial<Entry>;
    const entry = { text: old.text ?? "", category: legacyCategory(old.category ?? "normal"), start: old.start ?? defaultTimes(hour).start, end: old.end ?? defaultTimes(hour).end, blockId: old.blockId, rangeStart: old.rangeStart, rangeEnd: old.rangeEnd };
    if (!entry.blockId && durationHours(entry) > 1) Object.assign(entries, buildSegments(entry.text, entry.category, entry.start, entry.end, `migrated-${hour}-${entry.start}-${entry.end}`));
    else entries[hour] = entry;
  });
  return { intention: value.intention ?? "", reflection: value.reflection ?? "", entries };
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [day, setDay] = useState<DayLog>(EMPTY_DAY);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Entry & { slot: number }>({ slot: 9, text: "", category: "normal", ...defaultTimes(9) });
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const currentRow = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);
  const key = dateKey(selectedDate);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setDay(normalizeDay(JSON.parse(localStorage.getItem(`daymark:${key}`) ?? "null"))); }
      catch { setDay(EMPTY_DAY); }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(`daymark:${key}`, JSON.stringify(day));
    const show = window.setTimeout(() => setSaved(true), 0);
    const hide = window.setTimeout(() => setSaved(false), 1100);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [day, hydrated, key]);

  const filled = Object.values(day.entries).filter((entry) => entry.text.trim());
  const totalHours = filled.reduce((sum, entry) => sum + durationHours(entry), 0);
  const usefulHours = filled.reduce((sum, entry) => sum + durationHours(entry) * categories[entry.category].score, 0);
  const quality = totalHours ? Math.round((usefulHours / totalHours) * 100) : 0;
  const entryCount = new Set(Object.entries(day.entries).filter(([, entry]) => entry.text.trim()).map(([slot, entry]) => entry.blockId ?? `slot-${slot}`)).size;

  function changeDate(offset: number) { const next = new Date(selectedDate); next.setDate(next.getDate() + offset); setHydrated(false); setSelectedDate(next); }
  function updateEntry(hour: number, patch: Partial<Entry>) {
    setDay((current) => {
      const entries = { ...current.entries };
      const source = entries[hour];
      if (source?.blockId) {
        Object.keys(entries).forEach((slot) => {
          if (entries[Number(slot)].blockId === source.blockId) entries[Number(slot)] = { ...entries[Number(slot)], ...patch };
        });
      } else {
        entries[hour] = { text: source?.text ?? "", category: source?.category ?? "normal", ...(source ?? defaultTimes(hour)), ...patch };
      }
      return { ...current, entries };
    });
  }
  function openEditor(hour: number) {
    const entry = day.entries[hour];
    setEditingBlockId(entry?.blockId ?? null);
    setDraft({ slot: hour, text: entry?.text ?? "", category: entry?.category ?? "normal", start: entry?.rangeStart ?? entry?.start ?? defaultTimes(hour).start, end: entry?.rangeEnd ?? entry?.end ?? defaultTimes(hour).end });
    setEditorOpen(true);
  }
  function saveDraft() {
    const blockId = editingBlockId ?? `block-${Date.now()}`;
    setDay((current) => {
      const entries = { ...current.entries };
      if (editingBlockId) Object.keys(entries).forEach((slot) => { if (entries[Number(slot)].blockId === editingBlockId) delete entries[Number(slot)]; });
      else delete entries[draft.slot];
      const segments = buildSegments(draft.text, draft.category, draft.start, draft.end, blockId);
      const replacedBlocks = new Set(Object.keys(segments).map((slot) => entries[Number(slot)]?.blockId).filter((value): value is string => Boolean(value)));
      Object.keys(entries).forEach((slot) => { if (entries[Number(slot)].blockId && replacedBlocks.has(entries[Number(slot)].blockId!)) delete entries[Number(slot)]; });
      Object.assign(entries, segments);
      return { ...current, entries };
    });
    setEditorOpen(false);
  }
  function clearDraft() { setDay((current) => { const entries = { ...current.entries }; if (editingBlockId) Object.keys(entries).forEach((slot) => { if (entries[Number(slot)].blockId === editingBlockId) delete entries[Number(slot)]; }); else delete entries[draft.slot]; return { ...current, entries }; }); setEditorOpen(false); }
  function jumpToNow() { setHydrated(false); setSelectedDate(new Date()); window.setTimeout(() => currentRow.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120); }
  const dateLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(selectedDate);

  return (
    <main className="app-canvas">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark"><Check /></span><span>daymark</span></a>
        <div className="save-state"><span className={saved ? "save-dot active" : "save-dot"} />{saved ? "Saved" : "Private on this device"}</div>
        <button className="avatar" aria-label="Personal dashboard">AS</button>
      </header>

      <div className="page-shell" id="top">
        <section className="main-column">
          <section className="workspace-head">
            <div className="date-toolbar">
              <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} aria-label="Previous day"><ArrowLeft /></Button>
              <div className="date-button"><CalendarDays /><span><strong>{dateLabel}</strong><small>{sameDay(selectedDate, today) ? "TODAY" : key}</small></span></div>
              <Button variant="ghost" size="icon" onClick={() => changeDate(1)} aria-label="Next day"><ArrowRight /></Button>
            </div>
            <Button className="exact-cta" onClick={() => openEditor(new Date().getHours())}><Plus /> Log exact time</Button>
          </section>

          <section className="summary-strip" aria-label="Today's summary">
            <div className="summary-heading"><p>Daily log</p><h1>Today at a glance</h1></div>
            <div className="summary-metric"><span>Useful time</span><strong>{usefulHours.toFixed(1)}h</strong></div>
            <div className="summary-metric"><span>Tracked</span><strong>{totalHours.toFixed(1)}h</strong></div>
            <div className="summary-signal"><div><span>Productive signal</span><strong>{quality}%</strong></div><Progress value={quality} /></div>
          </section>

          <label className="intention-card"><Target /><span><small>TODAY&apos;S INTENTION</small><input value={day.intention} onChange={(event) => setDay((current) => ({ ...current, intention: event.target.value }))} placeholder="What would make today count?" maxLength={120} /></span><ChevronRight /></label>

          <section className="timeline" aria-label="Hourly log">
            <div className="timeline-title"><div><Clock3 /><h2>Your timeline</h2></div><span>{entryCount} entries · {totalHours.toFixed(1)}h tracked</span></div>
            <div className="hour-list">
              {Array.from({ length: 24 }, (_, hour) => {
                const entry = day.entries[hour] ?? { text: "", category: "normal" as Category, ...defaultTimes(hour) };
                const meta = categories[entry.category]; const Icon = meta.Icon;
                const isNow = sameDay(selectedDate, today) && hour === new Date().getHours(); const isLogged = Boolean(entry.text.trim());
                return (
                  <div className={`hour-row ${isNow ? "is-now" : ""} ${isLogged ? "is-logged" : ""}`} key={hour} ref={isNow ? currentRow : undefined} style={{ "--delay": `${Math.min(hour, 10) * 28}ms`, "--cat": meta.color } as CSSProperties}>
                    <div className="time-label"><strong>{displayTime(defaultTimes(hour).start)}</strong>{isLogged && <span>{durationHours(entry).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}h</span>}</div>
                    <div className="timeline-node">{isLogged ? <Icon /> : <span />}</div>
                    <div className="entry-surface">
                      <div className="entry-main"><input aria-label={`Activity at ${displayTime(defaultTimes(hour).start)}`} value={entry.text} onChange={(event) => updateEntry(hour, { text: event.target.value })} placeholder={isNow ? "What are you doing right now?" : "What happened here?"} maxLength={180} />{isLogged && <small>{displayTime(entry.start)} → {displayTime(entry.end)}</small>}</div>
                      <NativeSelect aria-label="Activity category" size="sm" value={entry.category} onChange={(event) => updateEntry(hour, { category: event.target.value as Category })} style={{ background: meta.tint, color: "#202333" }}>
                        {Object.entries(categories).map(([value, category]) => <NativeSelectOption value={value} key={value}>{category.label}</NativeSelectOption>)}
                      </NativeSelect>
                      <button className="edit-button" onClick={() => openEditor(hour)} aria-label={`Edit exact time for ${displayTime(defaultTimes(hour).start)}`}><Pencil /></button>
                    </div>
                    {isNow && <span className="now-pill">LIVE</span>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="reflection-card"><div><Sparkles /><span><small>END-OF-DAY NOTE</small><h2>What moved forward?</h2></span></div><Textarea value={day.reflection} onChange={(event) => setDay((current) => ({ ...current, reflection: event.target.value }))} placeholder="A win, a lesson, or something to carry into tomorrow…" maxLength={600} /></section>
        </section>

        <aside className="insights-column">
          <div className="insights-sticky">
            <p className="eyebrow dark"><BarChart3 /> TIME BY CATEGORY</p>
            <div className="category-cloud">{Object.entries(categories).map(([value, category]) => { const Icon = category.Icon; const amount = filled.filter((entry) => entry.category === value).reduce((sum, entry) => sum + durationHours(entry), 0); return <div key={value} className={amount ? "category-stat active" : "category-stat"}><i style={{ background: category.color }}><Icon /></i><span>{category.label}</span><strong>{amount ? `${amount.toFixed(1)}h` : "—"}</strong></div>; })}</div>
            <button className="now-button" onClick={jumpToNow}><TimerReset />Jump to current hour</button>
          </div>
        </aside>
      </div>

      <div className="mobile-score"><span><strong>{usefulHours.toFixed(1)}h</strong>useful</span><span><strong>{totalHours.toFixed(1)}h</strong>tracked</span><button onClick={() => openEditor(new Date().getHours())}><Plus /> Add block</button></div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="time-dialog">
          <DialogHeader><DialogTitle>Edit time block</DialogTitle><DialogDescription>Saving fills every hourly row covered by this time range.</DialogDescription></DialogHeader>
          <label className="dialog-field"><span>What did you do?</span><input value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} placeholder="Gym session, client work, lunch…" autoFocus /></label>
          <div className="time-fields"><label><span>Started</span><input type="time" value={draft.start} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} /></label><div className="duration-pill"><Clock3 /><strong>{durationHours(draft).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}h</strong><span>· {coveredSlotCount(draft.start, draft.end)} rows</span></div><label><span>Finished</span><input type="time" value={draft.end} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} /></label></div>
          <fieldset className="category-picker"><legend>Category</legend>{Object.entries(categories).map(([value, category]) => { const Icon = category.Icon; return <button type="button" key={value} className={draft.category === value ? "selected" : ""} style={{ "--pick": category.color, "--pick-bg": category.tint } as CSSProperties} onClick={() => setDraft((current) => ({ ...current, category: value as Category }))}><Icon /><span>{category.label}</span></button>; })}</fieldset>
          <DialogFooter><Button variant="ghost" className="delete-button" onClick={clearDraft}><Trash2 /> Clear entry</Button><Button className="save-block" onClick={saveDraft}><Check /> Save block</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
