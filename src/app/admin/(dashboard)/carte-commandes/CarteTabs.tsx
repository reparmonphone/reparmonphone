'use client';

import { useState } from 'react';
import type { GeoAgg, GeoPoint, PeriodKey } from '@/lib/orderGeo';
import OrdersGeoMap from './OrdersGeoMap';
import OrdersMap from './OrdersMap';

type Props = { aggs: Record<PeriodKey, GeoAgg>; points: GeoPoint[]; todo: number; failed: number };

export default function CarteTabs(props: Props) {
  const [tab, setTab] = useState<'precise' | 'zones'>('precise');
  const tabs: [typeof tab, string][] = [
    ['precise', '📍 Carte précise (OpenStreetMap)'],
    ['zones', '🗺️ Vue par pays et départements'],
  ];
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold ${tab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'precise' ? <OrdersGeoMap {...props} /> : <OrdersMap aggs={props.aggs} />}
    </div>
  );
}
