export const straw = { id: 'mulch-straw', name: 'Straw', notes: 'Dry material', version: 1 };
export const chips = { id: 'mulch-chips', name: 'Wood chips', notes: '', version: 2 };
export const mulchArea = (values = {}) => ({ id: 'mulch-area-a', name: 'Cover', xCm: 0, yCm: 0, widthCm: 100, lengthCm: 200,
  layers: [{ id: 'layer-a', material: { ...straw } }, { id: 'layer-b', material: { ...chips } }], ...values });
export const mulchPlan = (values = {}) => ({ version: 1, areas: [mulchArea()], ...values });
