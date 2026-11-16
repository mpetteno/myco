import type { GardenDimensions } from '../garden/garden';
import { LEGACY_PLANT_EDGE_CM } from './plantingPlan';
import type { BedPlantingPlan, PlantingArea } from './plantingPlan';
import { spacingAreaLayout } from './spacingAreaLayout';
import { balancedAreaLayout } from './balancedAreaLayout';

export const gridSpacingCm = (value: number) => Math.ceil(value / 5) * 5;

export function areaRowLayout(plan: BedPlantingPlan, area: PlantingArea, bed: GardenDimensions) {
  if (plan.version === 5) return balancedAreaLayout(area);
  if (plan.version === 3 || plan.version === 4) return spacingAreaLayout(area, plan.version);
  const edge = plan.version === 1 ? 5 : LEGACY_PLANT_EDGE_CM;
  const alongWidth = (plan.version === 1 ? plan.rowDirection : area.rowDirection) === 'width';
  const startX = Math.max(edge, area.xCm), startY = Math.max(edge, area.yCm);
  const endX = Math.min(bed.widthCm - edge, area.xCm + area.widthCm - 5);
  const endY = Math.min(bed.lengthCm - edge, area.yCm + area.lengthCm - 5);
  const alongStart = alongWidth ? startX : startY, alongEnd = alongWidth ? endX : endY;
  const acrossStart = alongWidth ? startY : startX, acrossEnd = alongWidth ? endY : endX;
  const plantStep = gridSpacingCm(area.plantSpacingCm), recommendedStep = gridSpacingCm(area.rowSpacingCm);
  const columns = Math.max(0, Math.floor((alongEnd - alongStart) / plantStep) + 1);
  const maxRows = Math.max(0, Math.floor((acrossEnd - acrossStart) / 5) + 1);
  const requested = plan.version === 2 ? area.rowCount ?? null : null;
  const rows = requested ?? Math.max(0, Math.floor((acrossEnd - acrossStart) / recommendedStep) + 1);
  const rowStep = requested && rows > 1 ? Math.floor((acrossEnd - acrossStart) / (rows - 1) / 5) * 5 : recommendedStep;
  const maxRowStep = requested && rows > 1 ? Math.ceil((acrossEnd - acrossStart) / (rows - 1) / 5) * 5 : rowStep;
  const rowPosition = (index: number) => requested
    ? rows === 1 ? Math.round((acrossStart + acrossEnd) / 10) * 5
      : acrossStart + Math.round(index * ((acrossEnd - acrossStart) / 5) / (rows - 1)) * 5
    : acrossStart + index * rowStep;
  const error = requested !== null && (requested > maxRows || !columns)
    ? `Area ${area.plant.name}: ${requested} rows requested, but only ${columns ? maxRows : 0} fit inside the 15 cm bed clearance and 5 cm grid.` : null;
  return { alongWidth, alongStart, alongEnd, columns, rows, rowPosition, plantStep, rowStep, maxRowStep, error,
    gapX: alongWidth ? plantStep : rowStep, gapY: alongWidth ? rowStep : plantStep };
}
