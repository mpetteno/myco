import { snapshot, bed } from './fixtures.mjs';
export { bed };
export const unplanted = (values = {}) => ({ id: 'area-a', name: '', xCm: 0, yCm: 0, widthCm: 100, lengthCm: 200, kind: 'unplanted', purpose: 'crop', mulch: [], ...values });
export const rows = (values = {}) => unplanted({ kind: 'rows', plant: { ...snapshot }, rowDirection: 'length', rowCount: 2, plantSpacingCm: 30, rowSpacingCm: 40, ...values });
export const mixture = () => ({ id: 'mix-a', name: 'Green manure mix', notes: 'Fixture', version: 1, components: [{ plant: { ...snapshot }, percentage: 60 }, { plant: { ...snapshot, id: 'type-b', name: 'Type B' }, percentage: 40 }] });
export const broadcast = (values = {}) => unplanted({ kind: 'broadcast', purpose: 'green_manure', sowing: { kind: 'mixture', mixture: mixture() }, density: 12.5, densityUnit: 'g_m2', ...values });
export const areaPlan = (...areas) => ({ version: 5, respectAreaSpacing: false, areas });
