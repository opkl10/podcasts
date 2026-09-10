'use client';

import React, { useRef, useCallback, useState } from 'react';
import { X, EyeOff, Eye, GripHorizontal } from 'lucide-react';
import { OverlayItem as OverlayItemType } from './overlays/overlayTypes';

interface OverlayItemProps {
  overlay: OverlayItemType;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPositionChange: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  onToggleVisible: (id: string) => void;
  children: React.ReactNode;
  isEditing?: boolean;
}

export default function OverlayItemWrapper({
  overlay,
  containerRef,
  onPositionChange,
  onRemove,
  onToggleVisible,
  children,
  isEditing = false,
}: OverlayItemProps) {
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [showControls, setShowControls] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditing) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const itemEl = (e.currentTarget as HTMLElement).parentElement;
      if (!itemEl) return;
      const itemRect = itemEl.getBoundingClientRect();

      dragOffset.current = {
        x: e.clientX - itemRect.left,
        y: e.clientY - itemRect.top,
      };

      const onMouseMove = (me: MouseEvent) => {
        if (!isDragging.current) return;
        const containerRect = container.getBoundingClientRect();
        const newX = ((me.clientX - containerRect.left - dragOffset.current.x) / containerRect.width) * 100;
        const newY = ((me.clientY - containerRect.top - dragOffset.current.y) / containerRect.height) * 100;
        onPositionChange(overlay.id, Math.max(0, Math.min(90, newX)), Math.max(0, Math.min(90, newY)));
      };

      const onMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [isEditing, containerRef, overlay.id, onPositionChange]
  );

  if (!overlay.visible) return null;

  return (
    <div
      className="absolute group/overlay"
      style={{ left: `${overlay.x}%`, top: `${overlay.y}%` }}
      onMouseEnter={() => isEditing && setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Drag handle (only in edit mode) */}
      {isEditing && (
        <div
          className="absolute -top-6 left-0 right-0 flex items-center justify-between bg-slate-900/90 border border-slate-600 rounded-t-lg px-1.5 py-0.5 cursor-move z-10"
          onMouseDown={handleMouseDown}
        >
          <GripHorizontal className="w-3 h-3 text-slate-400" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleVisible(overlay.id)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <EyeOff className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(overlay.id)}
              className="text-rose-400 hover:text-rose-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Overlay content */}
      <div className={isEditing ? 'outline outline-2 outline-dashed outline-purple-500/50 rounded' : ''}>
        {children}
      </div>
    </div>
  );
}
