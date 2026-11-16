export const bed = { id: 'bed-a', name: 'Kitchen bed', xCm: 0, yCm: 0, widthCm: 100, lengthCm: 200 };
export const snapshot = { id: 'type-a', name: 'Type A', familyId: 'family-a', familyName: 'Family A',
  typeVersion: 1, familyVersion: 1, plantSpacingCm: 30, rowSpacingCm: 40 };
export const area = (values = {}) => ({ id: 'area-a', xCm: 0, yCm: 0, widthCm: 100, lengthCm: 200,
  plant: { ...snapshot }, plantSpacingCm: 30, rowSpacingCm: 40, ...values });
export const plan = (values = {}) => ({ version: 1, rowDirection: 'length', respectAreaSpacing: true, areas: [area()], advice: [], ...values });
export const areaV2 = (values = {}) => area({ rowDirection: 'length', rowCount: null, ...values });
export const planV2 = (values = {}) => ({ version: 2, respectAreaSpacing: true, areas: [areaV2()], advice: [], ...values });
export const planV3 = (values = {}) => ({ version: 3, respectAreaSpacing: true, areas: [areaV2()], advice: [], ...values });
export const planV4 = (values = {}) => ({ version: 4, respectAreaSpacing: true, areas: [areaV2({ rowCount: 2 })], advice: [], ...values });
export const planV5 = (values = {}) => ({ version: 5, respectAreaSpacing: true, areas: [areaV2({ rowCount: 2 })], advice: [], ...values });
