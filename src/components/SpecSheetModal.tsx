import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Gauge, Scale, Wind, X } from 'lucide-react';
import type { CarConfig } from '../config/types';
import { buildSummary } from '../config/summary';
import { buildShareUrl } from '../config/urlState';
import { getGeneration } from '../data/schema';

interface SpecSheetModalProps {
  config: CarConfig;
  open: boolean;
  onClose: () => void;
}

/** Full itemised build sheet, exportable as JSON or a shareable URL. */
export const SpecSheetModal: React.FC<SpecSheetModalProps> = ({ config, open, onClose }) => {
  const [copied, setCopied] = useState<'json' | 'link' | null>(null);
  const summary = useMemo(() => buildSummary(config), [config]);
  const generation = getGeneration(config.generation);

  if (!open) return null;

  const groups = summary.lines.reduce<Record<string, typeof summary.lines>>((acc, line) => {
    (acc[line.group] ??= []).push(line);
    return acc;
  }, {});

  const copy = async (kind: 'json' | 'link') => {
    const payload = kind === 'json' ? JSON.stringify(config, null, 2) : buildShareUrl(config);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard unavailable — the download button below still works.
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ config, summary }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mx5-${config.generation}-build.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800 bg-slate-950/60 p-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red-500">Build specification</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{summary.title}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {generation.specs.engine} · {generation.specs.gearbox} · {generation.specs.layout}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-3">
            <Metric
              icon={<Scale className="h-4 w-4 text-amber-400" />}
              label="Kerb weight"
              value={`${summary.weightKg} kg`}
              delta={
                summary.weightDeltaKg === 0
                  ? 'Stock'
                  : `${summary.weightDeltaKg > 0 ? '+' : ''}${summary.weightDeltaKg} kg`
              }
              positive={summary.weightDeltaKg <= 0}
            />
            <Metric
              icon={<Gauge className="h-4 w-4 text-red-400" />}
              label="Power"
              value={`${summary.powerHp} hp`}
              delta={summary.powerDeltaHp === 0 ? 'Stock' : `+${summary.powerDeltaHp} hp`}
              positive
            />
            <Metric
              icon={<Wind className="h-4 w-4 text-cyan-400" />}
              label="Downforce"
              value={`${summary.downforceKg} kg`}
              delta="at 160 km/h"
              positive
            />
          </div>

          {Object.entries(groups).map(([group, lines]) => (
            <section key={group}>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{group}</h3>
              <dl className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-950/50 px-3">
                {lines.map((line) => (
                  <div key={`${group}-${line.label}`} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-[11px] text-slate-500">{line.label}</dt>
                    <dd className="flex items-baseline gap-3 text-right">
                      <span className="text-[11px] font-medium text-slate-200">{line.value}</span>
                      <span className="w-16 shrink-0 font-mono text-[10px] text-slate-500">
                        {line.price > 0 ? `+${line.price.toLocaleString()}` : '—'}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <div className="flex items-baseline justify-between rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3">
            <span className="text-xs text-slate-400">
              Base {summary.basePrice.toLocaleString()} + options
            </span>
            <span className="font-mono text-lg font-semibold text-slate-100">
              {summary.total.toLocaleString()}
            </span>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950/60 p-4">
          <div className="flex gap-2">
            <FooterButton onClick={() => copy('link')}>
              {copied === 'link' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'link' ? 'Link copied' : 'Copy share link'}
            </FooterButton>
            <FooterButton onClick={() => copy('json')}>
              {copied === 'json' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'json' ? 'JSON copied' : 'Copy JSON'}
            </FooterButton>
            <FooterButton onClick={downloadJson}>
              <Download className="h-3.5 w-3.5" />
              Download
            </FooterButton>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-red-600 px-4 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-red-500"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

const Metric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}> = ({ icon, label, value, delta, positive }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-500">
      {icon}
      {label}
    </div>
    <p className="mt-1.5 font-mono text-base font-semibold text-slate-100">{value}</p>
    <p className={`mt-0.5 font-mono text-[10px] ${positive ? 'text-emerald-400' : 'text-amber-400'}`}>{delta}</p>
  </div>
);

const FooterButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700"
  >
    {children}
  </button>
);
