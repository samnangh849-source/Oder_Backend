import React, { useContext, useState, useMemo } from 'react';
import CambodiaMap from '../components/cambodia-map/CambodiaMap';
import { AppContext } from '../context/AppContext';
import { DateRangePreset } from '../components/common/DateRangeFilter';

const CambodiaMapPage: React.FC = () => {
  const { setAppState, orders, advancedSettings, appData } = useContext(AppContext);
  const themeMode = advancedSettings?.themeMode ?? 'light';

  const [dateFilter, setDateFilter] = useState({
    preset: 'this_month' as DateRangePreset,
    start: '',
    end: ''
  });
  const [selectedTeam, setSelectedTeam] = useState<string>('All');

  const teams = useMemo(() => {
    const t = new Set<string>();
    t.add('All');
    appData.pages.forEach(p => {
      if (p.Team) t.add(p.Team);
    });
    return Array.from(t);
  }, [appData.pages]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Team Filter
      if (selectedTeam !== 'All' && o.Team !== selectedTeam) return false;

      // 2. Date Filter
      if (!o.Timestamp) return false;
      const d = new Date(o.Timestamp);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (dateFilter.preset === 'today') {
        if (d.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter.preset === 'this_week') {
        const day = now.getDay();
        const start = new Date(today);
        start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59);
        if (d < start || d > end) return false;
      } else if (dateFilter.preset === 'this_month') {
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      } else if (dateFilter.preset === 'custom') {
        const start = dateFilter.start ? new Date(dateFilter.start + 'T00:00:00') : null;
        const end = dateFilter.end ? new Date(dateFilter.end + 'T23:59:59') : null;
        if (start && d < start) return false;
        if (end && d > end) return false;
      }

      return true;
    });
  }, [orders, selectedTeam, dateFilter]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex-1 overflow-hidden relative">
        <CambodiaMap
          onBack={() => setAppState('role_selection')}
          orders={filteredOrders}
          themeMode={themeMode}
          // Pass filter props to CambodiaMap to be rendered in its header
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          teams={teams}
        />
      </div>
    </div>
  );
};

export default CambodiaMapPage;
