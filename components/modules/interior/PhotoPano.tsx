'use client';
/**
 * Raster panorama path. Used only when a flat's pano entry points at a real
 * equirectangular photo (8192x4096 recommended); otherwise the tour renders the
 * unit's own geometry through Room360.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { RoomId } from '@/lib/types';
import { usePhotoSphere, type Hotspot } from '../usePhotoSphere';

export default function PhotoPano({
  src,
  room,
  rooms,
  onNavigate,
  onYaw,
  onFailure,
}: {
  src: string;
  room: RoomId;
  rooms: { id: RoomId; label: string }[];
  onNavigate: (room: RoomId) => void;
  onYaw?: (yaw: number) => void;
  onFailure?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const hotspots = useMemo<Hotspot[]>(() => {
    const others = rooms.filter((r) => r.id !== room);
    return others.map((r, i) => ({
      id: `to-${r.id}`,
      yaw: (i / others.length) * Math.PI * 2 + 0.4,
      pitch: -0.28,
      label: r.label,
      to: r.id,
    }));
  }, [room, rooms]);

  const { yaw, progress, ready } = usePhotoSphere(container, src, hotspots, (to) => onNavigate(to as RoomId));
  onYaw?.(yaw);

  // Probe the file directly: the viewer only surfaces its own error overlay.
  useEffect(() => {
    let live = true;
    fetch(src, { method: 'HEAD' })
      .then((r) => {
        if (live && !r.ok) onFailure?.();
      })
      .catch(() => live && onFailure?.());
    return () => {
      live = false;
    };
  }, [src, onFailure]);

  return (
    <div className="absolute inset-0">
      <div ref={container} className="absolute inset-0" />
      {(progress < 100 || !ready) && (
        <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.max(8, progress)}%` }} />
        </div>
      )}
    </div>
  );
}
