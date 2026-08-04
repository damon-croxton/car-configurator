import { useCallback, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { ControlPanel } from './components/ControlPanel';
import { Header } from './components/Header';
import { SpecSheetModal } from './components/SpecSheetModal';
import { Viewport, type ViewportHandle } from './components/Viewport';
import { DEFAULT_CONFIG } from './config/defaults';
import type { PresetBuild } from './config/types';
import { useConfigurator } from './hooks/useConfigurator';

export default function App() {
  const { config, setConfig, replaceConfig, undo, canUndo } = useConfigurator();
  const [specSheetOpen, setSpecSheetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const viewportRef = useRef<ViewportHandle | null>(null);

  const handleSnapshot = useCallback(() => {
    const dataUrl = viewportRef.current?.capture(2);
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = `mx5-${config.generation}-${config.paint}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    confetti({ particleCount: 70, spread: 75, origin: { y: 0.6 }, disableForReducedMotion: true });
  }, [config.generation, config.paint]);

  const handleApplyPreset = useCallback(
    (preset: PresetBuild) => {
      replaceConfig({ ...DEFAULT_CONFIG, ...preset.config });
      setSidebarOpen(false);
    },
    [replaceConfig],
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans text-slate-100">
      <Header
        config={config}
        onApplyPreset={handleApplyPreset}
        onOpenSpecSheet={() => setSpecSheetOpen(true)}
        onSnapshot={handleSnapshot}
        onReset={() => replaceConfig(DEFAULT_CONFIG)}
        onUndo={undo}
        canUndo={canUndo}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />

      <div className="relative flex flex-1 overflow-hidden">
        <main className="h-full flex-1">
          <Viewport
            config={config}
            handleRef={viewportRef}
            onCameraPreset={(cameraPreset) => setConfig({ cameraPreset })}
          />
        </main>

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close configurator"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-20 bg-black/50 lg:hidden"
          />
        )}

        <aside
          className={`absolute bottom-0 right-0 top-0 z-30 w-[22rem] max-w-[88vw] transition-transform duration-300 lg:relative lg:max-w-none lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <ControlPanel config={config} onChange={setConfig} />
        </aside>
      </div>

      <SpecSheetModal config={config} open={specSheetOpen} onClose={() => setSpecSheetOpen(false)} />
    </div>
  );
}
