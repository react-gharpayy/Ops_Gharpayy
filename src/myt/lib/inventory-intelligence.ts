import { zones, teamMembers } from './mock-data';
import { properties } from './properties-seed';
import type { Booking, Lead, Room, RoomBlock, Tour } from './types';

const norm = (v: string) => (v || '').toLowerCase().trim();

export interface InventoryFit {
  propertyId: string;
  propertyName: string;
  zoneId: string;
  area: string;
  availableBeds: number;
  availableRooms: number;
  basePrice: number;
  priceFit: 'inside' | 'stretch' | 'low-fit';
  score: number;
  reason: string;
}

export interface AreaOperatingRow {
  zoneId: string;
  area: string;
  leads: number;
  qualifiedLeads: number;
  availableBeds: number;
  toursToday: number;
  bookings: number;
  tcmCapacity: number;
  signal: 'push-demand' | 'push-tours' | 'protect-capacity' | 'balanced';
  nextAction: string;
}

export function detectAreaZone(areaText: string) {
  const text = norm(areaText);
  return zones.find((z) => text.includes(norm(z.area)) || norm(z.area).includes(text)) ?? zones[0];
}

export function availableBedsForProperty(propertyId: string, rooms: Room[], blocks: RoomBlock[]) {
  const activeBlocks = new Set(
    blocks
      .filter((b) => b.propertyId === propertyId && b.status === 'active' && new Date(b.expiresAt).getTime() > Date.now())
      .map((b) => b.roomId),
  );
  const propRooms = rooms.filter((r) => r.propertyId === propertyId);
  const beds = propRooms.reduce((sum, room) => sum + Math.max(0, room.bedsTotal - room.bedsOccupied - (activeBlocks.has(room.id) ? 1 : 0)), 0);
  const openRooms = propRooms.filter((room) => room.bedsOccupied < room.bedsTotal && !activeBlocks.has(room.id)).length;
  return { beds, rooms: openRooms };
}

export function bestInventoryFits(input: {
  areaText: string;
  budget?: number;
  room?: string;
  rooms: Room[];
  blocks: RoomBlock[];
  limit?: number;
}): InventoryFit[] {
  const zone = detectAreaZone(input.areaText);
  const budget = input.budget || 0;
  return properties
    .map((p) => {
      const inv = availableBedsForProperty(p.id, input.rooms, input.blocks);
      const exactArea = norm(input.areaText).includes(norm(p.area)) || norm(p.area).includes(norm(input.areaText));
      const priceDelta = budget ? Math.abs(p.basePrice - budget) / Math.max(1, budget) : 0.2;
      const priceFit: InventoryFit['priceFit'] = !budget || priceDelta <= 0.15 ? 'inside' : p.basePrice > budget ? 'stretch' : 'low-fit';
      const score = Math.max(0, Math.round((exactArea ? 45 : p.zoneId === zone.id ? 32 : 8) + Math.min(30, inv.beds * 5) + (priceFit === 'inside' ? 25 : priceFit === 'stretch' ? 12 : 15)));
      return {
        propertyId: p.id,
        propertyName: p.name,
        zoneId: p.zoneId,
        area: p.area,
        availableBeds: inv.beds,
        availableRooms: inv.rooms,
        basePrice: p.basePrice,
        priceFit,
        score,
        reason: `${inv.beds} beds live · ${priceFit === 'inside' ? 'budget fit' : priceFit === 'stretch' ? 'slight stretch' : 'under budget'} · ${p.area}`,
      };
    })
    .filter((fit) => fit.availableBeds > 0)
    .sort((a, b) => b.score - a.score || b.availableBeds - a.availableBeds)
    .slice(0, input.limit ?? 3);
}

export function recommendedTcm(tours: Tour[], zoneId: string) {
  const tcms = teamMembers.filter((m) => m.role === 'tcm' && m.zoneId === zoneId);
  return [...tcms].sort((a, b) => todaysLoad(tours, a.id) - todaysLoad(tours, b.id))[0] ?? null;
}

export function recommendedFlowOps(zoneId: string) {
  return teamMembers.find((m) => m.role === 'flow-ops' && m.zoneId === zoneId) ?? teamMembers.find((m) => m.role === 'flow-ops') ?? null;
}

export function todaysLoad(tours: Tour[], memberId: string) {
  const today = new Date().toISOString().split('T')[0];
  return tours.filter((t) => t.tourDate === today && (t.assignedTo === memberId || t.scheduledBy === memberId) && t.status !== 'cancelled').length;
}

export function buildAreaOperatingRows(input: { leads: Lead[]; tours: Tour[]; rooms: Room[]; blocks: RoomBlock[]; bookings: Booking[] }): AreaOperatingRow[] {
  const today = new Date().toISOString().split('T')[0];
  return zones.map((z) => {
    const zoneProps = properties.filter((p) => p.zoneId === z.id);
    const availableBeds = zoneProps.reduce((sum, p) => sum + availableBedsForProperty(p.id, input.rooms, input.blocks).beds, 0);
    const leads = input.leads.filter((l) => detectAreaZone(l.area).id === z.id);
    const toursToday = input.tours.filter((t) => t.zoneId === z.id && t.tourDate === today && t.status !== 'cancelled').length;
    const bookings = input.bookings.filter((b) => norm(b.area) === norm(z.area)).length;
    const tcmCapacity = Math.max(0, teamMembers.filter((m) => m.role === 'tcm' && m.zoneId === z.id).length * 8 - toursToday);
    const signal: AreaOperatingRow['signal'] = availableBeds >= 8 && leads < 3 ? 'push-demand' : leads >= 3 && toursToday < Math.min(leads.length, 4) ? 'push-tours' : tcmCapacity < 2 ? 'protect-capacity' : 'balanced';
    const nextAction = signal === 'push-demand'
      ? `Create demand for ${availableBeds} live beds`
      : signal === 'push-tours'
        ? `Schedule ${Math.min(leads.length, availableBeds, 4)} Tours from matched leads`
        : signal === 'protect-capacity'
          ? 'Move soft Tours to another slot or TCM'
          : 'Keep matching leads to available rooms';
    return { zoneId: z.id, area: z.area, leads: leads.length, qualifiedLeads: leads.filter((l) => l.mytQualified).length, availableBeds, toursToday, bookings, tcmCapacity, signal, nextAction };
  });
}