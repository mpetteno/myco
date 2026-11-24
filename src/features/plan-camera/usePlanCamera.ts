import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { BedBounds } from '../beds/bed';
import type { GardenDimensions } from '../garden/garden';
import { getGardenViewport } from '../garden/gardenViewport';
import { fitBoundsCamera, panCamera, zoomCamera } from './planCamera';
import type { PlanCamera, CameraCommand, CanvasPoint, CanvasSize } from './planCamera';

type CameraState = { view: PlanCamera; size: CanvasSize };
type Gesture = { view: PlanCamera; center: CanvasPoint; distance: number };

// Camera gestures never write plan geometry or enter the plan's undo history.
export function usePlanCamera(element: RefObject<HTMLDivElement | null>, stage: RefObject<Konva.Stage | null>,
  dimensions: GardenDimensions | null, targets: (BedBounds & { id: string })[], size: CanvasSize, command: CameraCommand | undefined, panning: boolean) {
  const fit = dimensions ? getGardenViewport(dimensions, size) : null;
  const ready = !!fit;
  const [camera, setCamera] = useState<CameraState | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const blocked = useRef(false);
  const suppressClickUntil = useRef(0);
  // Preserve the viewed world point when the available canvas changes size.
  const view = camera ? panCamera(camera.view, { x: (size.width - camera.size.width) / 2, y: (size.height - camera.size.height) / 2 }) : fit;
  const current = useRef({ view, fit, size, targets });
  current.current = { view, fit, size, targets };
  function update(next: PlanCamera | null) {
    current.current.view = next;
    setCamera(next ? { view: next, size: current.current.size } : null);
  }
  useEffect(() => {
    const { view, fit, size, targets } = current.current;
    if (!command || !fit || !view) return;
    if (command.action === 'fit') { update(null); return; }
    if (command.action === 'focus') {
      const target = targets.find((item) => item.id === command.targetId);
      if (target) update(fitBoundsCamera(target, size, view));
    } else update(zoomCamera(view, { x: size.width / 2, y: size.height / 2 }, command.action === 'zoom-in' ? 1.25 : 0.8, fit.pixelsPerCm));
  }, [command, ready]);

  useEffect(() => {
    const surface = element.current;
    if (!surface) return;
    let gesture: Gesture | null = null;
    let mouse: { view: PlanCamera; point: CanvasPoint } | null = null;
    function point(client: { clientX: number; clientY: number }): CanvasPoint {
      const rect = surface!.getBoundingClientRect();
      return { x: client.clientX - rect.left, y: client.clientY - rect.top };
    }
    function stopEditing() {
      blocked.current = true;
      suppressClickUntil.current = Date.now() + 350;
      // stopDrag fires dragend, so block geometry commits before cancelling it.
      stage.current?.find((node: Konva.Node) => node.draggable()).forEach((node) => node.stopDrag());
      setGesturing(true);
    }
    function wheel(event: WheelEvent) {
      const { view, fit } = current.current;
      if (!view || !fit || blocked.current || stage.current?.find((node: Konva.Node) => node.isDragging()).length) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? current.current.size.height : 1);
      update(zoomCamera(view, point(event), Math.exp(-Math.max(-160, Math.min(160, delta)) * 0.005), fit.pixelsPerCm));
    }
    function touches(event: TouchEvent) {
      const { view } = current.current;
      if (!view || !event.touches.length) return null;
      const first = point(event.touches[0]), second = event.touches[1] ? point(event.touches[1]) : first;
      return { view, center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
        distance: Math.hypot(second.x - first.x, second.y - first.y) };
    }
    function touchStart(event: TouchEvent) {
      if (event.touches.length < 2 && !panning && !blocked.current) return;
      event.preventDefault(); event.stopPropagation();
      if (!blocked.current) stopEditing();
      gesture = touches(event);
    }
    function touchMove(event: TouchEvent) {
      if (!blocked.current) return;
      event.preventDefault(); event.stopPropagation();
      const next = touches(event), fit = current.current.fit;
      if (!next || !gesture || !fit) return;
      // Rebase when another finger joins or leaves the gesture.
      if (!!gesture.distance !== !!next.distance) { gesture = next; return; }
      const zoomed = zoomCamera(gesture.view, gesture.center, gesture.distance ? next.distance / gesture.distance : 1, fit.pixelsPerCm);
      update(panCamera(zoomed, { x: next.center.x - gesture.center.x, y: next.center.y - gesture.center.y }));
    }
    function touchEnd(event: TouchEvent) {
      if (!blocked.current) return;
      event.preventDefault(); event.stopPropagation();
      gesture = touches(event);
      suppressClickUntil.current = Date.now() + 350;
      if (!event.touches.length) { blocked.current = false; setGesturing(false); }
    }
    function mouseDown(event: MouseEvent) {
      if (!panning || event.button !== 0 || !current.current.view) return;
      event.preventDefault(); event.stopPropagation();
      mouse = { view: current.current.view, point: point(event) }; stopEditing();
    }
    function mouseMove(event: MouseEvent) {
      if (!mouse) return;
      const next = point(event);
      update(panCamera(mouse.view, { x: next.x - mouse.point.x, y: next.y - mouse.point.y }));
    }
    function mouseUp() {
      if (!mouse) return;
      mouse = null; blocked.current = false; setGesturing(false); suppressClickUntil.current = Date.now() + 350;
    }
    surface.addEventListener('wheel', wheel, { passive: false });
    surface.addEventListener('touchstart', touchStart, { capture: true, passive: false });
    surface.addEventListener('touchmove', touchMove, { capture: true, passive: false });
    surface.addEventListener('touchend', touchEnd, { capture: true, passive: false });
    surface.addEventListener('touchcancel', touchEnd, { capture: true, passive: false });
    surface.addEventListener('mousedown', mouseDown, true);
    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mouseup', mouseUp);
    window.addEventListener('blur', mouseUp);
    return () => {
      surface.removeEventListener('wheel', wheel);
      surface.removeEventListener('touchstart', touchStart, true);
      surface.removeEventListener('touchmove', touchMove, true);
      surface.removeEventListener('touchend', touchEnd, true);
      surface.removeEventListener('touchcancel', touchEnd, true);
      surface.removeEventListener('mousedown', mouseDown, true);
      window.removeEventListener('mousemove', mouseMove);
      window.removeEventListener('mouseup', mouseUp);
      window.removeEventListener('blur', mouseUp);
      blocked.current = false;
      setGesturing(false);
    };
  }, [element, stage, panning]);
  return { view, gesturing, blocked, suppressClickUntil };
}
