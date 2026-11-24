import type { PlantingArea } from './plantingPlan';
import { effectiveClearances } from './plantClearances';

export function balancedAreaLayout(area: PlantingArea) {
  const margins = effectiveClearances(area);
  const alongWidth = area.rowDirection === 'width';
  const plantStep = Math.ceil(area.plantSpacingCm / 5) * 5, targetRowStep = Math.ceil(area.rowSpacingCm / 5) * 5;
  const alongOrigin = alongWidth ? area.xCm : area.yCm, acrossOrigin = alongWidth ? area.yCm : area.xCm;
  const alongSize = alongWidth ? area.widthCm : area.lengthCm, acrossSize = alongWidth ? area.lengthCm : area.widthCm;
  const alongNear = alongWidth ? margins.left : margins.top, alongFar = alongWidth ? margins.right : margins.bottom;
  const acrossNear = alongWidth ? margins.top : margins.left, acrossFar = alongWidth ? margins.bottom : margins.right;
  const alongSpan = alongSize - alongNear - alongFar, acrossSpan = acrossSize - acrossNear - acrossFar;
  const columns = Math.max(0, Math.floor(alongSpan / plantStep) + 1);
  const maxRows = Math.max(0, Math.floor(acrossSpan / 5) + 1);
  const requested = area.rowCount ?? null;
  const rows = requested ?? Math.max(0, Math.floor(acrossSpan / targetRowStep) + 1);
  // Keep the chosen spacing until a border reaches the saved plant minimum.
  const rowSpan = rows > 1 ? Math.min((rows - 1) * targetRowStep, acrossSpan) : 0;
  const rowStep = rows > 1 ? Math.floor(rowSpan / (rows - 1) / 5) * 5 : targetRowStep;
  const maxRowStep = rows > 1 ? Math.ceil(rowSpan / (rows - 1) / 5) * 5 : targetRowStep;
  const rowStart = acrossOrigin + acrossNear + Math.round((acrossSpan - rowSpan) / 10) * 5;
  const rowPosition = (index: number) => rowStart + (rows > 1 ? Math.round(index * (rowSpan / 5) / (rows - 1)) * 5 : 0);
  const alongStart = alongOrigin + alongNear + Math.round((alongSpan - (columns - 1) * plantStep) / 10) * 5;
  const alongEnd = alongStart + (columns - 1) * plantStep;
  const error = (requested !== null && (requested > maxRows || columns < 1)) || (area.clearancesCm !== undefined && (!rows || !columns))
    ? `Area ${area.plant.name}: planting does not fit its minimum clearances and the 5 cm grid${requested !== null ? ` with ${requested} rows` : ''}.` : null;
  return { alongWidth, alongStart, alongEnd, columns, rows, rowPosition, plantStep, rowStep, maxRowStep, error,
    gapX: alongWidth ? plantStep : rowStep, gapY: alongWidth ? rowStep : plantStep };
}
