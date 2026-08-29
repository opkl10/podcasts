'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ElementTransform } from '@/lib/types';
import { Move, ZoomIn, ZoomOut, RotateCcw, X, Lock, Unlock } from 'lucide-react';

interface DraggableOverlayProps {
  transform: ElementTransform;
  onUpdateTransform: (newTransform: ElementTransform) => void;
  onClose?: () => void;
  isEditMode?: boolean;
  className?: string;
  defaultPosition?: ElementTransform;
  children: React.ReactNode;
}

export default function DraggableOverlay({
  transform,
  onUpdateTransform,
  onClose,
  isEditMode = true,
  className = '',
  defaultPosition = { x: 10, y: 10, scale: 1.0 },
  children
}: DraggableOverlayProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: transform.x,
    initY: transform.y
  });
  const [resizeStart, setResizeStart] = useState<{ startY: number; initScale: number }>({
    startY: 0,
    initScale: transform.scale
  });

  // Pointer Drag Handler
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag if left click
    if (e.button !== 0) return;
    
    // Prevent dragging when clicking buttons or inputs inside
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('.no-drag')) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragStart({
      startX: e.clientX,
      startY: e.clientY,
      initX: transform.x,
      initY: transform.y
    });

    if (elementRef.current) {
      elementRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDragging) {
      const parent = elementRef.current?.parentElement;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStart.startX) / parentRect.width) * 100;
      const deltaY = ((e.clientY - dragStart.startY) / parentRect.height) * 100;

      const newX = Math.max(0, Math.min(85, dragStart.initX + deltaX));
      const newY = Math.max(0, Math.min(85, dragStart.initY + deltaY));

      onUpdateTransform({
        ...transform,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10
      });
    } else if (isResizing) {
      const deltaScale = (resizeStart.startY - e.clientY) * 0.008;
      const newScale = Math.max(0.4, Math.min(2.5, resizeStart.initScale + deltaScale));
      onUpdateTransform({
        ...transform,
        scale: Math.round(newScale * 100) / 100
      });
    }
  }, [isDragging, isResizing, dragStart, resizeStart, transform, onUpdateTransform]);

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      try {
        elementRef.current?.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Resize Corner Drag Handler
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      startY: e.clientY,
      initScale: transform.scale
    });
    if (elementRef.current) {
      elementRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handleScaleStep = (step: number) => {
    const newScale = Math.max(0.4, Math.min(2.5, transform.scale + step));
    onUpdateTransform({
      ...transform,
      scale: Math.round(newScale * 100) / 100
    });
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateTransform(defaultPosition);
  };

  return (
    <div
      ref={elementRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'absolute',
        left: `${transform.x}%`,
        top: `${transform.y}%`,
        transform: `scale(${transform.scale})`,
        transformOrigin: 'top left',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none'
      }}
      className={`group/item select-none transition-shadow ${
        isDragging ? 'z-50 shadow-2xl scale-[1.02]' : 'z-20'
      } ${className}`}
    >
      {/* Floating Control Toolbar (Visible on hover or edit mode) */}
      <div className="absolute -top-8 left-0 flex items-center gap-1 bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/20 text-white text-[10px] opacity-0 group-hover/item:opacity-100 transition-opacity z-50 pointer-events-auto no-drag shadow-xl">
        <span className="flex items-center gap-1 text-slate-400 font-mono font-bold">
          <Move className="w-3 h-3 text-indigo-400" />
          <span>גרור למיקום</span>
        </span>

        <span className="text-slate-600">|</span>

        {/* Scale Controls */}
        <button
          onClick={() => handleScaleStep(-0.15)}
          className="p-1 hover:text-indigo-300 rounded hover:bg-white/10"
          title="הקטן אלמנט"
        >
          <ZoomOut className="w-3 h-3" />
        </button>

        <span className="font-mono font-bold text-indigo-300 px-0.5">
          {Math.round(transform.scale * 100)}%
        </span>

        <button
          onClick={() => handleScaleStep(0.15)}
          className="p-1 hover:text-indigo-300 rounded hover:bg-white/10"
          title="הגדל אלמנט"
        >
          <ZoomIn className="w-3 h-3" />
        </button>

        <button
          onClick={handleReset}
          className="p-1 hover:text-amber-300 rounded hover:bg-white/10 ml-0.5"
          title="אפס מיקום וגודל"
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:text-rose-400 rounded hover:bg-white/10 ml-0.5"
            title="הסר מהמסך"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Main Inner Content */}
      <div className="relative">
        {children}

        {/* Bottom Right Resize Drag Corner */}
        <div
          onPointerDown={handleResizeStart}
          className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-indigo-600 border-2 border-white shadow-lg cursor-nwse-resize opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-opacity z-50 no-drag"
          title="גרור לשינוי גודל (Resize)"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}
