import { useMemo, useState } from 'react';
import { useAppState } from '@/myt/lib/app-context';
import { properties as allProperties } from '@/myt/lib/properties-seed';
import { scoreProperty } from '@/myt/lib/scoring';
import { PropertyCard } from '@/myt/components/PropertyCard';
import { SignalChip } from '@/myt/components/SignalChip';
import { UrgencyTimer } from '@/myt/components/UrgencyTimer';
import { zones } from '@/myt/lib/mock-data';
import { Search, Building2, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Property, PropertyScores } from '@/myt/lib/types';
import { cn } from '@/lib/utils';

export default function PropertyCommandCenter() {
  const { tours, leads, rooms, blocks, globalZoneFilter } = useAppState();
  const [search, setSearch] = useState('');
  const [signalFilter, setSignalFilter] = useState<'all' | 'hot' | 'balanced' | 'cold'>('all');
  const [selected, setSelected] = useState<Property | null>(null);

  const scoredProps = useMemo(() => {
    return allProperties
      .map(p => ({ p, s: scoreProperty(p, rooms, tours, leads, blocks) }))
      .filter(({ p }) => !globalZoneFilter || p.zoneId === globalZoneFilter)
      .filter(({ p }) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.area.toLowerCase().includes(search.toLowerCase()))
      .filter(({ s }) => signalFilter === 'all' || s.signal === signalFilter)
      .sort((a, b) => b.s.demandScore - a.s.demandScore);
  }, [rooms, tours, leads, blocks, globalZoneFilter, search, signalFilter]);

  const totals = useMemo(() => {
    const all = allProperties.map(p => scoreProperty(p, rooms, tours, leads, blocks));
    return {
      hot: all.filter(s => s.signal === 'hot').length,
      cold: all.filter(s => s.signal === 'cold').length,
      revenue: all.reduce((sum, s) => sum + s.revenueWeek, 0),
      missed: all.reduce((sum, s) => sum + s.missedRevenue, 0),
      blockedBeds: all.reduce((sum, s) => sum + s.bedsBlocked, 0),
    };
  }, [rooms, tours, leads, blocks]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Property Command Center
        </h1>
        <p className="text-xs text-muted-foreground">Live demand, conversion & velocity per property</p>
      </div>

      {/* Top totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <SummaryTile label="🔥 Hot" value={totals.hot} />
        <SummaryTile label="❄️ Cold" value={totals.cold} />
        <SummaryTile label="Beds Held" value={totals.blockedBeds} />
        <SummaryTile label="Revenue (7d)" value={`₹${(totals.revenue/1000).toFixed(0)}k`} />
        <SummaryTile label="Missed (7d)" value={`₹${(totals.missed/1000).toFixed(0)}k`} accent="danger" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search property or area…"
            className="pl-8 h-9 bg-surface-2 border-border text-xs"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'hot', 'balanced', 'cold'] as const).map(f => (
            <button
              key={f}
              onClick={() => setSignalFilter(f)}
              className={cn(
                'px-2.5 h-9 rounded-md text-[11px] font-medium uppercase tracking-wide transition-colors',
                signalFilter === f ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {scoredProps.map(({ p, s }) => (
          <PropertyCard key={p.id} property={p} scores={s} onClick={() => setSelected(p)} />
        ))}
      </div>

      {scoredProps.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">No properties match these filters.</div>
      )}

      {/* Drawer */}
      {selected && (
        <PropertyDrawer property={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: string | number; accent?: 'danger' }) {
  return (
    <div className="glass-card p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        'text-lg font-bold tabular-nums mt-0.5',
        accent === 'danger' ? 'text-danger' : 'text-foreground'
      )}>{value}</div>
    </div>
  );
}

function PropertyDrawer({ property, onClose }: { property: Property; onClose: () => void }) {
  const { tours, leads, rooms, blocks } = useAppState();
  const scores = scoreProperty(property, rooms, tours, leads, blocks);
  const propRooms = rooms.filter(r => r.propertyId === property.id);
  const activeBlocks = blocks.filter(b => b.propertyId === property.id && b.status === 'active' && new Date(b.expiresAt).getTime() > Date.now());
  const recentTours = tours.filter(t => t.propertyName === property.name).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex md:items-center md:justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full md:max-w-2xl md:max-h-[85vh] max-h-[90vh] bg-card border border-border md:rounded-xl rounded-t-2xl mt-auto md:mt-0 overflow-y-auto"
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-foreground">{property.name}</h3>
              <SignalChip signal={scores.signal} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{property.address} · Owner: {property.ownerName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Suggested actions */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Recommended Actions</h4>
            {scores.suggestedActions.map((a, i) => (
              <div key={i} className="text-xs text-foreground bg-primary/5 border border-primary/20 rounded px-3 py-2 flex items-start gap-2">
                <span>💡</span><span>{a}</span>
              </div>
            ))}
          </div>

          {/* Rooms */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Rooms ({propRooms.length})</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {propRooms.map(r => {
                const blocksOnRoom = activeBlocks.filter(b => b.roomId === r.id).length;
                const free = r.bedsTotal - r.bedsOccupied - blocksOnRoom;
                return (
                  <div key={r.id} className="rounded-lg border border-border bg-surface-2 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground capitalize">{r.type}</span>
                      <span className="text-[10px] text-muted-foreground">₹{(r.currentPrice/1000).toFixed(1)}k</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {free} free · {r.bedsOccupied} taken{blocksOnRoom > 0 && ` · ${blocksOnRoom} held`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active blocks */}
          {activeBlocks.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />Active Holds
              </h4>
              <div className="space-y-1.5">
                {activeBlocks.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-xs bg-surface-2 rounded px-3 py-2">
                    <span className="text-foreground">{b.leadName} <span className="text-muted-foreground">· {b.intent}</span></span>
                    <UrgencyTimer expiresAt={b.expiresAt} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent tours */}
          {recentTours.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Recent Tours</h4>
              <div className="space-y-1">
                {recentTours.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs bg-surface-2 rounded px-3 py-1.5">
                    <span className="text-foreground truncate">{t.leadName}</span>
                    <span className="text-muted-foreground capitalize">{t.status} {t.outcome ? `· ${t.outcome}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
