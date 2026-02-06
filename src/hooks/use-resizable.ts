import { useRef, useCallback, useEffect } from "react";

interface UseResizableOptions {
  onResize?: (size: { width: number; height: number }) => void;
  onResizeEnd?: (size: { width: number; height: number }) => void;
  enabled?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export function useResizable(
  elementRef: React.RefObject<HTMLElement | null>,
  options: UseResizableOptions = {}
) {
  const {
    onResize,
    onResizeEnd,
    enabled = true,
    minWidth = 300,
    minHeight = 400,
    maxWidth = 800,
    maxHeight = 900,
  } = options;

  const isResizing = useRef(false);
  const startSize = useRef({ width: 0, height: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const currentSize = useRef({ width: 0, height: 0 });

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!enabled || !elementRef.current) return;

      const rect = elementRef.current.getBoundingClientRect();
      startSize.current = {
        width: rect.width,
        height: rect.height,
      };
      startPos.current = {
        x: e.clientX,
        y: e.clientY,
      };
      currentSize.current = startSize.current;
      isResizing.current = true;
      e.preventDefault();
      e.stopPropagation();
    },
    [enabled, elementRef]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current || !enabled) return;

      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;

      const newWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startSize.current.width + deltaX)
      );
      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, startSize.current.height + deltaY)
      );

      currentSize.current = { width: newWidth, height: newHeight };

      if (onResize) {
        onResize(currentSize.current);
      }
    },
    [enabled, onResize, minWidth, minHeight, maxWidth, maxHeight]
  );

  const handleMouseUp = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;

    if (onResizeEnd) {
      onResizeEnd(currentSize.current);
    }
  }, [onResizeEnd]);

  useEffect(() => {
    if (!enabled) return;

    const handle = elementRef.current?.querySelector(".resize-handle");
    if (!handle) return;

    (handle as HTMLElement).addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      (handle as HTMLElement).removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [enabled, elementRef, handleMouseDown, handleMouseMove, handleMouseUp]);
}
