import { useRef, useCallback, useEffect } from "react";

interface UseDraggableOptions {
  onDrag?: (position: { x: number; y: number }) => void;
  onDragEnd?: (position: { x: number; y: number }) => void;
  enabled?: boolean;
}

export function useDraggable(
  elementRef: React.RefObject<HTMLElement | null>,
  options: UseDraggableOptions = {}
) {
  const { onDrag, onDragEnd, enabled = true } = options;
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!enabled || !elementRef.current) return;

      const rect = elementRef.current.getBoundingClientRect();
      startPos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      currentPos.current = {
        x: rect.left,
        y: rect.top,
      };
      isDragging.current = true;
      e.preventDefault();
    },
    [enabled, elementRef]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || !enabled) return;

      const newX = e.clientX - startPos.current.x;
      const newY = e.clientY - startPos.current.y;

      // Constrain to viewport
      const maxX = window.innerWidth - (elementRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (elementRef.current?.offsetHeight || 0);

      const constrainedX = Math.max(0, Math.min(newX, maxX));
      const constrainedY = Math.max(0, Math.min(newY, maxY));

      currentPos.current = { x: constrainedX, y: constrainedY };

      if (onDrag) {
        onDrag(currentPos.current);
      }
    },
    [enabled, onDrag, elementRef]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (onDragEnd) {
      onDragEnd(currentPos.current);
    }
  }, [onDragEnd]);

  useEffect(() => {
    if (!enabled) return;

    const element = elementRef.current;
    if (!element) return;

    element.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      element.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [enabled, elementRef, handleMouseDown, handleMouseMove, handleMouseUp]);
}
