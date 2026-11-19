import type { GardenLocation } from '../gardens/gardenLocation';
import { GrowingCalendar } from './GrowingCalendar';
export function GardenCalendarGuidance({ userId, location }: { userId: string; location?: GardenLocation }) {
  return <GrowingCalendar userId={userId} location={location} />;
}
