import type { PlantingArea } from './plantingPlan';
import { planAreaMargins } from './spacingMargins';

export function spacingAreaLayout(area: PlantingArea, version: 3 | 4 = 3) {
  const alongWidth = area.rowDirection === 'width';
  const { alongCm, acrossCm } = planAreaMargins({ version }, area);
  const plantStep = Math.ceil(area.plantSpacingCm / 5) * 5, recommendedStep = Math.ceil(area.rowSpacingCm / 5) * 5;
  const alongOrigin = alongWidth ? area.xCm : area.yCm, acrossOrigin = alongWidth ? area.yCm : area.xCm;
  const alongSize = alongWidth ? area.widthCm : area.lengthCm, acrossSize = alongWidth ? area.lengthCm : area.widthCm;
  const alongMin = alongOrigin + alongCm, alongMax = alongOrigin + alongSize - alongCm;
  const acrossMin = acrossOrigin + acrossCm, acrossMax = acrossOrigin + acrossSize - acrossCm;
  const columns = Math.max(0, Math.floor((alongMax - alongMin) / plantStep) + 1);
  const maxRows = Math.max(0, Math.floor((acrossMax - acrossMin) / 5) + 1);
  const requested = area.rowCount ?? null;
  const rows = requested ?? Math.max(0, Math.floor((acrossMax - acrossMin) / recommendedStep) + 1);
  const rowStep = requested && rows > 1 ? Math.floor((acrossMax - acrossMin) / (rows - 1) / 5) * 5 : recommendedStep;
  const maxRowStep = requested && rows > 1 ? Math.ceil((acrossMax - acrossMin) / (rows - 1) / 5) * 5 : rowStep;
  // Centre unused space for automatic spacing; opposite clearances differ by at most one grid cell.
  const alongStart = alongMin + Math.round((alongMax - alongMin - (columns - 1) * plantStep) / 10) * 5;
  const alongEnd = alongStart + (columns - 1) * plantStep;
  const automaticStart = acrossMin + Math.round((acrossMax - acrossMin - (rows - 1) * rowStep) / 10) * 5;
  const rowPosition = (index: number) => requested
    ? rows === 1 ? Math.round((acrossMin + acrossMax) / 10) * 5
      : acrossMin + Math.round(index * ((acrossMax - acrossMin) / 5) / (rows - 1)) * 5
    : automaticStart + index * rowStep;
  const error = requested !== null && (requested > maxRows || columns < 1)
    ? `Area ${area.plant.name}: ${requested} rows do not fit with ${acrossCm} cm side margins and ${alongCm} cm end margins.` : null;
  return { alongWidth, alongStart, alongEnd, columns, rows, rowPosition, plantStep, rowStep, maxRowStep, error,
    gapX: alongWidth ? plantStep : rowStep, gapY: alongWidth ? rowStep : plantStep };
}
