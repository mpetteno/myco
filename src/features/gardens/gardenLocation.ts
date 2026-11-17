import { english } from '../../shared/i18n/i18n';

export const supportedRegions = ['IT-21', 'IT-23', 'IT-25', 'IT-32', 'IT-34', 'IT-36', 'IT-42', 'IT-45', 'IT-52', 'IT-55', 'IT-57', 'IT-62'] as const;
type RegionCode = typeof supportedRegions[number];
export type GardenLocation = {
  displayName: string; countryCode: string; regionCode: string; city?: string;
  // Retain existing resolved locations and allow exact geocoding in the future.
  enteredLocation?: string; latitude?: number; longitude?: number;
};
export function createRegionLocation(regionCode: string, city = ''): GardenLocation | undefined {
  const name = city.trim();
  if (!supportedRegions.some((region) => region === regionCode) || name.length > 100) return undefined;
  const region = english(`catalogue.option.${regionCode as RegionCode}`);
  return { countryCode: 'IT', regionCode, displayName: name ? `${name}, ${region}` : region, ...(name ? { city: name } : {}) };
}
export function validGardenLocation(value: unknown): value is GardenLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as GardenLocation;
  if (typeof location.displayName !== 'string' || !location.displayName.trim() || location.displayName.length > 1000
    || location.countryCode !== 'IT' || !supportedRegions.some((region) => region === location.regionCode)
    || (location.city !== undefined && (typeof location.city !== 'string' || location.city.length > 100))
    || (location.enteredLocation !== undefined && (typeof location.enteredLocation !== 'string' || !location.enteredLocation.trim() || location.enteredLocation.length > 500))) return false;
  if (location.latitude !== undefined || location.longitude !== undefined) {
    return typeof location.latitude === 'number' && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
      && typeof location.longitude === 'number' && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
  }
  return true;
}
