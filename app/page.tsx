"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, Circle, Clock3, Flame, Moon, Sparkles, Sun, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

type Category = "focus" | "progress" | "maintenance" | "recharge";
type Entry = { text: string; category: Category };
type DayLog = { intention: string; reflection: string; entries: Record<number, Entry> };
const EMPTY_DAY: DayLog = { intention: "", reflection: "", entries: {} };
const categories: Record<Category, { label: string; score: number; color: string }> = {
  focus: { label: "Deep work", score: 1, color: "#9bf23b" },
  progress: { label: "Progress", score: 0.8, color: "#7fdcf1" },
  maintenance: { label: "Maintenance", score: 0.5, color: "#f5c96a" },
  recharge: { label: "Recharge", score: 0, color: "#9b95b5" },
};
const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
function formatHour(hour: number) {
  const start = `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`;
  const endHour = (hour + 1) % 24;
  return { start, end: `${endHour % 12 || 12}:00 ${endHour < 12 ? "AM" : "PM"}` };
}
function sameDay(a: Date, b: Date) { return dateKey(a) === dateKey(b); }

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [day, setDay] = useState<DayLog>(EMPTY_DAY);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const currentRow = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);
  const key = dateKey(selectedDate);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const stored = localStorage.getItem(`daymark:${key}`);
      setDay(stored ? JSON.parse(stored) : EMPTY_DAY);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(`daymark:${key}`, JSON.stringify(day));
    const showTimer = window.setTimeout(() => setSaved(true), 0);
    const hideTimer = window.setTimeout(() => setSaved(false), 1200);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [day, hydrated, key]);

  const filledEntries = Object.values(day.entries).filter((entry) => entry.text.trim());
  const productiveHours = filledEntries.reduce((sum, entry) => sum + categories[entry.category].score, 0);
  const loggedHours = filledEntries.length;
  const focusHours = filledEntries.filter((entry) => entry.category === "focus").length;
  const dayProgress = Math.round((loggedHours / 24) * 100);
  const quality = loggedHours ? Math.round((productiveHours / loggedHours) * 100) : 0;

  function changeDate(offset: number) {
    const next = new Date(selectedDate); next.setDate(next.getDate() + offset);
    setHydrated(false); setSelectedDate(next);
  }
  function updateEntry(hour: number, patch: Partial<Entry>) {
    setDay((current) => ({ ...current, entries: { ...current.entries, [hour]: { text: current.entries[hour]?.text ?? "", category: current.entries[hour]?.category ?? "focus", ...patch } } }));
  }
  function jumpToNow() {
    setHydrated(false); setSelectedDate(new Date());
    window.setTimeout(() => currentRow.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  }
  const dateLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(selectedDate);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Daymark home"><span className="brand-mark"><Check /></span><span>daymark</span></a>
        <div className="save-state" aria-live="polite"><span className={saved ? "save-dot active" : "save-dot"} />{saved ? "Saved" : "Saved locally"}</div>
        <button className="avatar" aria-label="Personal dashboard">AS</button>
      </header>

      <div className="page-shell" id="top">
        <section className="main-column">
          <div className="date-toolbar">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} aria-label="Previous day"><ArrowLeft /></Button>
            <button className="date-button" onClick={jumpToNow}><CalendarDays /><span><strong>{dateLabel}</strong><small>{sameDay(selectedDate, today) ? "Today" : key}</small></span></button>
            <Button variant="ghost" size="icon" onClick={() => changeDate(1)} aria-label="Next day"><ArrowRight /></Button>
          </div>

          <section className="day-heading" aria-labelledby="day-title">
            <div><p className="eyebrow"><Sun /> DAILY LOG</p><h1 id="day-title">Where did your day go?</h1><p className="heading-copy">Capture each hour. Keep the honest picture.</p></div>
            {!sameDay(selectedDate, today) && <Button variant="outline" onClick={jumpToNow}>Back to today</Button>}
          </section>

          <label className="intention-card"><Target /><span><small>TODAY&apos;S INTENTION</small><input value={day.intention} onChange={(event) => setDay((current) => ({ ...current, intention: event.target.value }))} placeholder="What would make today count?" maxLength={120} /></span></label>

          <section className="timeline" aria-label="Hourly log">
            <div className="timeline-title"><div><Clock3 /><h2>Hour by hour</h2></div><span>{loggedHours}/24 logged</span></div>
            <div className="hour-list">
              {Array.from({ length: 24 }, (_, hour) => {
                const entry = day.entries[hour] ?? { text: "", category: "focus" as Category };
                const time = formatHour(hour);
                const isNow = sameDay(selectedDate, today) && hour === new Date().getHours();
                const isLogged = Boolean(entry.text.trim());
                return (
                  <div className={`hour-row ${isNow ? "is-now" : ""} ${isLogged ? "is-logged" : ""}`} key={hour} ref={isNow ? currentRow : undefined}>
                    <div className="time-label"><strong>{time.start}</strong><span>{time.end}</span></div>
                    <div className="timeline-node" aria-hidden="true">{isLogged ? <Check /> : <Circle />}</div>
                    <div className="entry-surface">
                      <input aria-label={`Activity from ${time.start} to ${time.end}`} value={entry.text} onChange={(event) => updateEntry(hour, { text: event.target.value })} placeholder={isNow ? "What are you doing right now?" : "What did you do?"} maxLength={180} />
                      <NativeSelect aria-label={`Impact for ${time.start}`} size="sm" className={`category-select category-${entry.category}`} value={entry.category} onChange={(event) => updateEntry(hour, { category: event.target.value as Category })}>
                        {Object.entries(categories).map(([value, category]) => <NativeSelectOption value={value} key={value}>{category.label}</NativeSelectOption>)}
                      </NativeSelect>
                    </div>
                    {isNow && <span className="now-pill">NOW</span>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="reflection-card"><div><Sparkles /><span><small>END-OF-DAY NOTE</small><h2>What moved forward?</h2></span></div><Textarea value={day.reflection} onChange={(event) => setDay((current) => ({ ...current, reflection: event.target.value }))} placeholder="A win, a lesson, or something to carry into tomorrow…" maxLength={600} /></section>
        </section>

        <aside className="insights-column" aria-label="Daily progress">
          <div className="insights-sticky">
            <p className="eyebrow"><BarChart3 /> DAY AT A GLANCE</p>
            <div className="score-card"><div className="score-ring" style={{ "--score": `${quality * 3.6}deg` } as React.CSSProperties}><span><strong>{productiveHours.toFixed(1)}</strong><small>useful hrs</small></span></div><div><p>Productive time</p><strong>{quality}% quality</strong><span>{loggedHours ? "based on logged hours" : "start with your first hour"}</span></div></div>
            <div className="metric-grid"><div className="metric-card lime"><Flame /><strong>{focusHours}h</strong><span>deep work</span></div><div className="metric-card blue"><Clock3 /><strong>{loggedHours}h</strong><span>accounted for</span></div></div>
            <div className="progress-card"><div><span>Day captured</span><strong>{dayProgress}%</strong></div><Progress value={dayProgress} /><p>{24 - loggedHours} hours still open</p></div>
            <div className="legend-card"><h3>Impact key</h3>{Object.entries(categories).map(([value, category]) => <div key={value}><i style={{ background: category.color }} /><span>{category.label}</span><small>{category.score ? `×${category.score}` : "rest"}</small></div>)}</div>
            <button className="now-button" onClick={jumpToNow}><Moon />Jump to current hour</button>
          </div>
        </aside>
      </div>

      <div className="mobile-score" aria-label="Today's summary"><span><strong>{productiveHours.toFixed(1)}h</strong> useful</span><span><strong>{loggedHours}/24</strong> logged</span><button onClick={jumpToNow}>Jump to now</button></div>
    </main>
  );
}
