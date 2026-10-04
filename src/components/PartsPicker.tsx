import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { MOD_AREAS, MOD_GROUP_LABELS, type ModEntry } from '../data/mods';

/**
 * The "Additional parts" list, kept compact: each area folds to one line,
 * exclusive variants (mirrors, stripes, seats...) collapse into a single row
 * of pills, standalone parts are two-column chips with the description as a
 * tooltip, and a search box filters the lot.
 */
export const PartsPicker: React.FC<{
  extras: ModEntry[];
  fitted: string[];
  onToggle: (id: string, on: boolean) => void;
}> = ({ extras, fitted, onToggle }) => {
  const [query, setQuery] = useState('');
  // Areas that already have something fitted start open; the rest fold.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(extras.filter((m) => fitted.includes(m.id)).map((m) => m.area ?? 'top')),
  );

  const needle = query.trim().toLowerCase();
  const matches = (mod: ModEntry) =>
    !needle || `${mod.displayName} ${mod.uiHint ?? ''} ${MOD_GROUP_LABELS[mod.group ?? ''] ?? ''}`
      .toLowerCase().includes(needle);

  const areas = useMemo(() => MOD_AREAS.map(({ id, label }) => {
    const parts = extras.filter((mod) => (mod.area ?? 'top') === id);
    const groups = new Map<string, ModEntry[]>();
    const singles: ModEntry[] = [];
    for (const mod of parts) {
      if (mod.group) groups.set(mod.group, [...(groups.get(mod.group) ?? []), mod]);
      else singles.push(mod);
    }
    return { id, label, parts, groups: [...groups.entries()], singles };
  }), [extras]);

  const toggleArea = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${extras.length} parts`}
          className="w-full bg-transparent text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-slate-500 hover:text-slate-300">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      {areas.map(({ id, label, parts, groups, singles }) => {
        if (parts.length === 0) return null;
        const shownGroups = groups.map(([g, mods]) => [g, mods.filter(matches)] as const).filter(([, mods]) => mods.length > 0);
        const shownSingles = singles.filter(matches);
        if (needle && shownGroups.length === 0 && shownSingles.length === 0) return null;
        const count = parts.filter((mod) => fitted.includes(mod.id)).length;
        const expanded = Boolean(needle) || open.has(id);
        return (
          <div key={id} className="rounded-lg border border-slate-700/60 bg-slate-800/20">
            <button
              type="button"
              onClick={() => toggleArea(id)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
            >
              <span className="text-[11px] font-medium text-slate-300">{label}</span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                {count > 0 ? <span className="text-red-300">{count} fitted</span> : null}
                <span>{parts.length}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {expanded && (
              <div className="space-y-2.5 border-t border-slate-700/50 px-2.5 pb-2.5 pt-2">
                {shownGroups.map(([group, mods]) => {
                  const all = groups.find(([g]) => g === group)?.[1] ?? mods;
                  const active = all.find((mod) => fitted.includes(mod.id));
                  return (
                    <div key={group}>
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                        {MOD_GROUP_LABELS[group] ?? group}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {!needle && (
                          <Pill label="None" active={!active} onClick={() => active && onToggle(active.id, false)} />
                        )}
                        {mods.map((mod) => (
                          <Pill
                            key={mod.id}
                            label={mod.displayName}
                            title={mod.uiHint}
                            active={active?.id === mod.id}
                            onClick={() => onToggle(mod.id, active?.id !== mod.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {shownSingles.length > 0 && (
                  <div className="grid grid-cols-2 gap-1">
                    {shownSingles.map((mod) => {
                      const on = fitted.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          role="switch"
                          aria-checked={on}
                          title={mod.uiHint}
                          onClick={() => onToggle(mod.id, !on)}
                          className={`flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors ${
                            on
                              ? 'border-red-500/70 bg-red-500/10 text-slate-50'
                              : 'border-slate-700/70 bg-slate-800/40 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <span
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                              on ? 'border-red-500 bg-red-600' : 'border-slate-500'
                            }`}
                          >
                            {on && <Check className="h-2.5 w-2.5" strokeWidth={3} color="#fff" />}
                          </span>
                          <span className="truncate text-[11px] leading-tight">{mod.displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Pill: React.FC<{ label: string; title?: string; active: boolean; onClick: () => void }> = ({
  label, title, active, onClick,
}) => (
  <button
    type="button"
    aria-pressed={active}
    title={title}
    onClick={onClick}
    className={`rounded-md border px-2 py-1 text-[10.5px] leading-tight transition-colors ${
      active
        ? 'border-red-500/70 bg-red-500/10 text-slate-50'
        : 'border-slate-700/70 bg-slate-800/40 text-slate-300 hover:border-slate-500'
    }`}
  >
    {label}
  </button>
);
