import React, { useState, useRef } from 'react';
import { CameraPreset, CarConfig } from './types';
import { DEFAULT_CONFIG } from './data/presets';
import { Header } from './components/Header';
import { RenderViewport } from './components/RenderViewport';
import { ControlPanel } from './components/ControlPanel';
import { BuildSummaryModal } from './components/BuildSummaryModal';
import confetti from 'canvas-confetti';

export default function App() {
  const [config, setConfig] = useState<CarConfig>(DEFAULT_CONFIG);
  const [selectedCamera, setSelectedCamera] = useState<CameraPreset>('hero_34');
  const [isSpecSheetOpen, setIsSpecSheetOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Snapshot Capture Handler
  const handleTakeSnapshot = () => {
    if (!canvasRef.current) return;
    const originalCanvas = canvasRef.current;

    // Create a temporary canvas with watermark overlay
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = originalCanvas.width;
    exportCanvas.height = originalCanvas.height;
    const ctx = exportCanvas.getContext('2d');

    if (ctx) {
      // Draw 3D Render
      ctx.drawImage(originalCanvas, 0, 0);

      // Add Studio Watermark Banner
      const w = exportCanvas.width;
      const h = exportCanvas.height;

      // Top-left Watermark Badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.roundRect(24, 24, 320, 68, 12);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('MAZDA MX-5 ND ROADSTER', 40, 52);

      ctx.fillStyle = '#ef4444';
      ctx.font = '13px monospace';
      ctx.fillText(`BUILD: ${config.paintName.toUpperCase()}`, 40, 74);

      // Trigger download
      const imageUri = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `mx5-nd-render-${Date.now()}.png`;
      link.href = imageUri;
      link.click();

      // Confetti celebration
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.5 },
      });
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setSelectedCamera('hero_34');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Top Navigation Bar */}
      <Header
        config={config}
        onChangeConfig={setConfig}
        selectedCamera={selectedCamera}
        onSelectCamera={setSelectedCamera}
        onOpenSpecSheet={() => setIsSpecSheetOpen(true)}
        onTakeSnapshot={handleTakeSnapshot}
        onReset={handleReset}
        toggleSidebarMobile={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Main Studio Viewport & Sidebar Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 3D Render Viewport Stage */}
        <main className="flex-1 h-full relative">
          <RenderViewport
            config={config}
            selectedCamera={selectedCamera}
            onCameraChange={setSelectedCamera}
            setSnapshotCanvasRef={(ref) => {
              canvasRef.current = ref;
            }}
          />
        </main>

        {/* Right Desktop / Mobile Customizer Drawer */}
        <div
          className={`absolute lg:relative right-0 top-0 bottom-0 z-30 transition-transform duration-300 ${
            isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <ControlPanel config={config} onChangeConfig={setConfig} />
        </div>
      </div>

      {/* Build Spec Sheet Modal */}
      <BuildSummaryModal
        config={config}
        isOpen={isSpecSheetOpen}
        onClose={() => setIsSpecSheetOpen(false)}
      />
    </div>
  );
}
