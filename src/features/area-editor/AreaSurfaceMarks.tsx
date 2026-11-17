import { Rect } from 'react-konva';
import type { BedAreaPlan } from './areaPlan';

export function AreaSurfaceMarks({ plan, pixelsPerCm, dark }: { plan?: BedAreaPlan; pixelsPerCm: number; dark: boolean }) {
  return <>{plan?.areas.filter((area) => area.kind === 'broadcast').map((area) => <Rect key={area.id} x={area.xCm} y={area.yCm} width={area.widthCm} height={area.lengthCm}
    fill={area.purpose === 'green_manure' ? (dark ? '#4ade80' : '#15803d') : (dark ? '#facc15' : '#a16207')} opacity={0.25}
    stroke={dark ? '#d9f99d' : '#365314'} strokeWidth={1 / pixelsPerCm} dash={[4 / pixelsPerCm, 4 / pixelsPerCm]} listening={false} />)}</>;
}
