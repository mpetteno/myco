import { MIN_AREA_MARGIN_CM } from './plantingPlan';
import type { PlantingArea } from './plantingPlan';

export function balancedAreaLayout(area: PlantingArea) {
  const marginCm = area.plant.borderDistanceCm ?? MIN_AREA_MARGIN_CM;
  const alongWidth = area.rowDirection === 'width';
  const plantStep = Math.ceil(area.plantSpacingCm / 5) * 5, targetRowStep = Math.ceil(area.rowSpacingCm / 5) * 5;
  const alongOrigin = alongWidth ? area.xCm : area.yCm, acrossOrigin = alongWidth ? area.yCm : area.xCm;
  const alongSize = alongWidth ? area.widthCm : area.lengthCm, acrossSize = alongWidth ? area.lengthCm : area.widthCm;
  const alongSpan = alongSize - 2 * marginCm, acrossSpan = acrossSize - 2 * marginCm;
  const columns = Math.max(0, Math.floor(alongSpan / plantStep) + 1);
  const maxRows = Math.max(0, Math.floor(acrossSpan / 5) + 1);
  const requested = area.rowCount ?? null;
  const rows = requested ?? Math.max(0, Math.floor(acrossSpan / targetRowStep) + 1);
  // Keep the chosen spacing until a border reaches the saved plant minimum.
  const rowSpan = rows > 1 ? Math.min((rows - 1) * targetRowStep, acrossSpan) : 0;
  const rowStep = rows > 1 ? Math.floor(rowSpan / (rows - 1) / 5) * 5 : targetRowStep;
  const maxRowStep = rows > 1 ? Math.ceil(rowSpan / (rows - 1) / 5) * 5 : targetRowStep;
  const rowStart = acrossOrigin + Math.round((acrossSize - rowSpan) / 10) * 5;
  const rowPosition = (index: number) => rowStart + (rows > 1 ? Math.round(index * (rowSpan / 5) / (rows - 1)) * 5 : 0);
  const alongStart = alongOrigin + Math.round((alongSize - (columns - 1) * plantStep) / 10) * 5;
  const alongEnd = alongStart + (columns - 1) * plantStep;
  const error = requested !== null && (requested > maxRows || columns < 1)
    ? `Area ${area.plant.name}: ${requested} rows do not fit with ${marginCm} cm minimum border clearance and the 5 cm grid.` : null;
  return { alongWidth, alongStart, alongEnd, columns, rows, rowPosition, plantStep, rowStep, maxRowStep, error,
    gapX: alongWidth ? plantStep : rowStep, gapY: alongWidth ? rowStep : plantStep };
}
