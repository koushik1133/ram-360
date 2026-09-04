'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Viewer, Position } from '@photo-sphere-viewer/core';
import type { MarkersPlugin, MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

export interface Hotspot { id: string; yaw: number; pitch: number; label: string; to: string }

export function hotspotMarkers(hotspots: Hotspot[]): MarkerConfig[] {
  return hotspots.map((h) => ({
    id: h.id,
    position: { yaw: h.yaw, pitch: h.pitch },
    html: `<div class="psv-hotspot" title="${h.label}"><div style="display:grid;place-items:center;line-height:1"><div>↑</div><span>${h.label.toUpperCase()}</span></div></div>`,
    size: { width: 64, height: 64 },
    anchor: 'center center',
    data: { to: h.to },
  }));
}

/**
 * Wraps @photo-sphere-viewer/core + markers plugin.
 * Creates the viewer once per container, swaps panoramas with a cross-fade, exposes yaw and load progress.
 */
export function usePhotoSphere(container: RefObject<HTMLDivElement>, panorama: string, hotspots: Hotspot[], onHotspot: (to: string) => void) {
  const viewerRef = useRef<Viewer | null>(null);
  const markersRef = useRef<MarkersPlugin | null>(null);
  const hotspotCb = useRef(onHotspot);
  hotspotCb.current = onHotspot;
  const [yaw, setYaw] = useState(0);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let viewer: Viewer | null = null;
    (async () => {
      const { Viewer } = await import('@photo-sphere-viewer/core');
      const { MarkersPlugin } = await import('@photo-sphere-viewer/markers-plugin');
      if (disposed || !container.current) return;
      viewer = new Viewer({
        container: container.current,
        panorama,
        navbar: false,
        loadingTxt: '',
        defaultZoomLvl: 10,
        moveInertia: true,
        mousewheel: true,
        touchmoveTwoFingers: false,
        plugins: [[MarkersPlugin, { markers: hotspotMarkers(hotspots) }]],
      });
      const markers = viewer.getPlugin(MarkersPlugin) as MarkersPlugin;
      markers.addEventListener('select-marker', ({ marker }) => {
        const to = (marker.config.data as { to?: string } | undefined)?.to;
        if (to) hotspotCb.current(to);
      });
      viewer.addEventListener('position-updated', ({ position }: { position: Position }) => setYaw(position.yaw));
      viewer.addEventListener('load-progress', ({ progress: p }) => setProgress(p));
      viewer.addEventListener('ready', () => { setReady(true); setProgress(100); }, { once: true });
      viewerRef.current = viewer;
      markersRef.current = markers;
    })();
    return () => {
      disposed = true;
      viewer?.destroy();
      viewerRef.current = null;
      markersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !ready) return;
    setProgress(0);
    v.setPanorama(panorama, { transition: { speed: 900, effect: 'fade', rotation: false }, showLoader: false })
      .then(() => { markersRef.current?.setMarkers(hotspotMarkers(hotspots)); setProgress(100); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panorama, ready]);

  return { yaw, progress, ready, viewerRef };
}
