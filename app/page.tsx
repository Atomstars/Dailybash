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
type TimeBlock = { id: string; text: string; category: Category; start: string; end: string };
type DayLog = { intention: string; reflection: string; blocks: TimeBlock[] };
type TimelineSlice = { start: number; end: number; block?: TimeBlock };
type CategoryMeta = { label: string; score: number; color: string; tint: string; Icon: ComponentType<{ className?: string }> };

const EMPTY_DAY: DayLog = { intention: "", reflection: "", blocks: [] };
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
const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
const timeFromMinutes = (value: number) => { const normalized = ((value % 1440) + 1440) % 1440; return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`; };
const displayMinute = (value: number) => { const normalized = value % 1440; const h = Math.floor(normalized / 60); const m = normalized % 60; return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`; };
const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);
const legacyCategory = (value: string): Category => ({ focus: "deep", progress: "normal", maintenance: "chores", recharge: "free" }[value] as Category) || (value in categories ? value as Category : "normal");
const blockDuration = (block: Pick<TimeBlock, "start" | "end">) => { let end = minutes(block.end); const start = minutes(block.start); if (end <= start) end += 1440; return (end - start) / 60; };
const coveredSlotCount = (start: string, end: string) => { const startMinute = minutes(start); let endMinute = minutes(end); if (endMinute <= startMinute) endMinute += 1440; return Math.ceil(endMinute / 60) - Math.floor(startMinute / 60); };
const blockIntervals = (block: TimeBlock) => { const start = minutes(block.start); const end = minutes(block.end); return end > start ? [{ start, end, block }] : [{ start: 0, end, block }, { start, end: 1440, block }]; };
const overlaps = (a: TimeBlock, b: TimeBlock) => blockIntervals(a).some((left) => blockIntervals(b).some((right) => left.start < right.end && right.start < left.end));

function splitInterval(start: number, end: number, block?: TimeBlock) {
  const slices: TimelineSlice[] = [];
  let cursor = start;
  while (cursor < end) {
    const nextHour = (Math.floor(cursor / 60) + 1) * 60;
    const next = Math.min(end, nextHour);
    slices.push({ start: cursor, end: next, block });
    cursor = next;
  }
  return slices;
}

function buildTimeline(blocks: TimeBlock[]) {
  const intervals = blocks.flatMap(blockIntervals).sort((a, b) => a.start - b.start);
  const slices: TimelineSlice[] = [];
  let cursor = 0;
  intervals.forEach((interval) => {
    if (interval.start > cursor) slices.push(...splitInterval(cursor, interval.start));
    const visibleStart = Math.max(cursor, interval.start);
    if (interval.end > visibleStart) slices.push(...splitInterval(visibleStart, interval.end, interval.block));
    cursor = Math.max(cursor, interval.end);
  });
  if (cursor < 1440) slices.push(...splitInterval(cursor, 1440));
  return slices;
}

function normalizeDay(raw: unknown): DayLog {
  if (!raw || typeof raw !== "object") return EMPTY_DAY;
  const value = raw as { intention?: string; reflection?: string; blocks?: unknown[]; entries?: Record<string, unknown> };
  if (Array.isArray(value.blocks)) {
    const blocks = value.blocks.flatMap((candidate, index) => {
      const block = candidate as Partial<TimeBlock>;
      if (!block.text?.trim() || !block.start || !block.end) return [];
      return [{ id: block.id ?? `saved-${index}-${block.start}`, text: block.text, category: legacyCategory(block.category ?? "normal"), start: block.start, end: block.end }];
    });
    return { intention: value.intention ?? "", reflection: value.reflection ?? "", blocks };
  }
  const grouped = new Map<string, TimeBlock>();
  Object.entries(value.entries ?? {}).forEach(([slot, candidate]) => {
    const entry = candidate as { text?: string; category?: string; start?: string; end?: string; blockId?: string; rangeStart?: string; rangeEnd?: string };
    if (!entry.text?.trim()) return;
    const id = entry.blockId ?? `legacy-${slot}`;
    if (!grouped.has(id)) grouped.set(id, { id, text: entry.text, category: legacyCategory(entry.category ?? "normal"), start: entry.rangeStart ?? entry.start ?? `${pad(Number(slot))}:00`, end: entry.rangeEnd ?? entry.end ?? `${pad((Number(slot) + 1) % 24)}:00` });
  });
  return { intention: value.intention ?? "", reflection: value.reflection ?? "", blocks: [...grouped.values()] };
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [day, setDay] = useState<DayLog>(EMPTY_DAY);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<TimeBlock, "id">>({ text: "", category: "normal", start: "09:00", end: "10:00" });
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

  const blocks = day.blocks.filter((block) => block.text.trim());
  const timeline = buildTimeline(blocks);
  const totalHours = blocks.reduce((sum, block) => sum + blockDuration(block), 0);
  const usefulHours = blocks.reduce((sum, block) => sum + blockDuration(block) * categories[block.category].score, 0);
  const quality = totalHours ? Math.round((usefulHours / totalHours) * 100) : 0;

  function changeDate(offset: number) { const next = new Date(selectedDate); next.setDate(next.getDate() + offset); setHydrated(false); setSelectedDate(next); }
  function openNew(start?: number, end?: number) {
    const now = new Date(); const startMinute = start ?? now.getHours() * 60 + now.getMinutes(); const endMinute = end ?? Math.min(1440, (Math.floor(startMinute / 60) + 1) * 60);
    setEditingBlockId(null);
    setDraft({ text: "", category: "normal", start: timeFromMinutes(startMinute), end: timeFromMinutes(endMinute) });
    setEditorOpen(true);
  }
  function openBlock(block: TimeBlock) { setEditingBlockId(block.id); setDraft({ text: block.text, category: block.category, start: block.start, end: block.end }); setEditorOpen(true); }
  function updateBlock(id: string, patch: Partial<TimeBlock>) { setDay((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) })); }
  function saveDraft() {
    if (!draft.text.trim()) return;
    const candidate: TimeBlock = { id: editingBlockId ?? `block-${Date.now()}`, ...draft, text: draft.text.trim() };
    setDay((current) => ({ ...current, blocks: [...current.blocks.filter((block) => block.id !== editingBlockId && !overlaps(block, candidate)), candidate] }));
    setEditorOpen(false);
  }
  function clearDraft() { if (editingBlockId) setDay((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== editingBlockId) })); setEditorOpen(false); }
  function jumpToNow() { setHydrated(false); setSelectedDate(new Date()); window.setTimeout(() => currentRow.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120); }
  const dateLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(selectedDate);
  const currentMinute = new Date().getHours() * 60 + new Date().getMinutes();

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
            <Button className="exact-cta" onClick={() => openNew()}><Plus /> Log exact time</Button>
          </section>

          <section className="summary-strip" aria-label="Today's summary">
            <div className="summary-heading"><p>Daily log</p><h1>Today at a glance</h1></div>
            <div className="summary-metric"><span>Useful time</span><strong>{usefulHours.toFixed(1)}h</strong></div>
            <div className="summary-metric"><span>Tracked</span><strong>{totalHours.toFixed(1)}h</strong></div>
            <div className="summary-signal"><div><span>Productive signal</span><strong>{quality}%</strong></div><Progress value={quality} /></div>
          </section>

          <label className="intention-card"><Target /><span><small>TODAY&apos;S INTENTION</small><input value={day.intention} onChange={(event) => setDay((current) => ({ ...current, intention: event.target.value }))} placeholder="What would make today count?" maxLength={120} /></span><ChevronRight /></label>

          <section className="timeline" aria-label="Daily time coverage">
            <div className="timeline-title"><div><Clock3 /><h2>Your timeline</h2></div><span>{blocks.length} activities · {totalHours.toFixed(1)}h tracked</span></div>
            <div className="hour-list">
              {timeline.map((slice, index) => {
                const block = slice.block;
                const isNow = sameDay(selectedDate, today) && currentMinute >= slice.start && currentMinute < slice.end;
                if (!block) return (
                  <div className={`hour-row is-gap ${isNow ? "is-now" : ""}`} key={`gap-${slice.start}-${slice.end}`} ref={isNow ? currentRow : undefined} style={{ "--delay": `${Math.min(index, 10) * 22}ms` } as CSSProperties}>
                    <div className="time-label"><strong>{displayMinute(slice.start)}</strong><span>{((slice.end - slice.start) / 60).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}h</span></div>
                    <div className="timeline-node"><Plus /></div>
                    <button className="gap-action" onClick={() => openNew(slice.start, slice.end)}><span><strong>{isNow ? "Unlogged right now" : "Unlogged time"}</strong><small>{displayMinute(slice.start)} → {displayMinute(slice.end)}</small></span><b>Add activity</b></button>
                    {isNow && <span className="now-pill">LIVE</span>}
                  </div>
                );
                const meta = categories[block.category]; const Icon = meta.Icon;
                return (
                  <div className={`hour-row is-logged ${isNow ? "is-now" : ""}`} key={`${block.id}-${slice.start}`} ref={isNow ? currentRow : undefined} style={{ "--delay": `${Math.min(index, 10) * 22}ms`, "--cat": meta.color } as CSSProperties}>
                    <div className="time-label"><strong>{displayMinute(slice.start)}</strong><span>{((slice.end - slice.start) / 60).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}h</span></div>
                    <div className="timeline-node"><Icon /></div>
                    <div className="entry-surface">
                      <div className="entry-main"><input aria-label={`Activity from ${displayMinute(slice.start)}`} value={block.text} onChange={(event) => updateBlock(block.id, { text: event.target.value })} maxLength={180} /><small>{displayMinute(slice.start)} → {displayMinute(slice.end)}</small></div>
                      <NativeSelect aria-label="Activity category" size="sm" value={block.category} onChange={(event) => updateBlock(block.id, { category: event.target.value as Category })} style={{ background: meta.tint, color: "#202333" }}>{Object.entries(categories).map(([value, category]) => <NativeSelectOption value={value} key={value}>{category.label}</NativeSelectOption>)}</NativeSelect>
                      <button className="edit-button" onClick={() => openBlock(block)} aria-label={`Edit ${block.text}`}><Pencil /></button>
                    </div>
                    {isNow && <span className="now-pill">LIVE</span>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="reflection-card"><div><Sparkles /><span><small>END-OF-DAY NOTE</small><h2>What moved forward?</h2></span></div><Textarea value={day.reflection} onChange={(event) => setDay((current) => ({ ...current, reflection: event.target.value }))} placeholder="A win, a lesson, or something to carry into tomorrow…" maxLength={600} /></section>
        </section>

        <aside className="insights-column"><div className="insights-sticky"><p className="eyebrow dark"><BarChart3 /> TIME BY CATEGORY</p><div className="category-cloud">{Object.entries(categories).map(([value, category]) => { const Icon = category.Icon; const amount = blocks.filter((block) => block.category === value).reduce((sum, block) => sum + blockDuration(block), 0); return <div key={value} className={amount ? "category-stat active" : "category-stat"}><i style={{ background: category.color }}><Icon /></i><span>{category.label}</span><strong>{amount ? `${amount.toFixed(1)}h` : "—"}</strong></div>; })}</div><button className="now-button" onClick={jumpToNow}><TimerReset />Jump to current time</button></div></aside>
      </div>

      <button className="mobile-add-shortcut" onClick={() => openNew()} aria-label="Add an activity at an exact time">
        <Plus />
        <span>Add time</span>
      </button>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="time-dialog">
          <DialogHeader><DialogTitle>{editingBlockId ? "Edit activity" : "Log activity"}</DialogTitle><DialogDescription>This exact period will be filled; every remaining minute stays visibly unlogged.</DialogDescription></DialogHeader>
          <label className="dialog-field"><span>What did you do?</span><input value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} placeholder="Lunch, commute, client work…" autoFocus required /></label>
          <div className="time-fields"><label><span>Started</span><input type="time" value={draft.start} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} /></label><div className="duration-pill"><Clock3 /><strong>{blockDuration(draft).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}h</strong><span>· {coveredSlotCount(draft.start, draft.end)} rows</span></div><label><span>Finished</span><input type="time" value={draft.end} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} /></label></div>
          <fieldset className="category-picker"><legend>Category</legend>{Object.entries(categories).map(([value, category]) => { const Icon = category.Icon; return <button type="button" key={value} className={draft.category === value ? "selected" : ""} style={{ "--pick": category.color, "--pick-bg": category.tint } as CSSProperties} onClick={() => setDraft((current) => ({ ...current, category: value as Category }))}><Icon /><span>{category.label}</span></button>; })}</fieldset>
          <DialogFooter>{editingBlockId && <Button variant="ghost" className="delete-button" onClick={clearDraft}><Trash2 /> Delete activity</Button>}<Button className="save-block" onClick={saveDraft} disabled={!draft.text.trim()}><Check /> Save activity</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
