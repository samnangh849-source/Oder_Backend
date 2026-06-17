export interface ProvinceData {
  province_id: string;
  name_km: string;
  name_en: string;
  capital: string;
  capital_en: string;
  area_km2: number;
  population: number;
  gdp_usd: number;
  unemployment_rate: number;
  main_economic_sector: string;
}

export type MetricKey = 'population' | 'area_km2' | 'gdp_usd' | 'unemployment_rate' | 'revenue' | 'orders_count';

export type Language = 'km' | 'en';

export interface MetricConfig {
  key: MetricKey;
  label_km: string;
  label_en: string;
  unit_km: string;
  unit_en: string;
  format: (val: number) => string;
  colorRange: string[];
}

export const METRICS: Record<MetricKey, MetricConfig> = {
  population: {
    key: 'population',
    label_km: 'ប្រជាជន',
    label_en: 'Population',
    unit_km: 'នាក់',
    unit_en: 'people',
    format: (v) => v.toLocaleString(),
    colorRange: ['#FEE2E2', '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626', '#B91C1C'],
  },
  area_km2: {
    key: 'area_km2',
    label_km: 'ផ្ទៃក្រឡា',
    label_en: 'Area',
    unit_km: 'km²',
    unit_en: 'km²',
    format: (v) => v.toLocaleString() + ' km²',
    colorRange: ['#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8'],
  },
  gdp_usd: {
    key: 'gdp_usd',
    label_km: 'GDP',
    label_en: 'GDP',
    unit_km: 'USD',
    unit_en: 'USD',
    format: (v) => '$' + (v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : v.toLocaleString()),
    colorRange: ['#D1FAE5', '#A7F3D0', '#6EE7B7', '#34D399', '#10B981', '#059669', '#047857'],
  },
  unemployment_rate: {
    key: 'unemployment_rate',
    label_km: 'អត្រាគ្មានការងារ',
    label_en: 'Unemployment',
    unit_km: '%',
    unit_en: '%',
    format: (v) => v.toFixed(1) + '%',
    colorRange: ['#FEF3C7', '#FDE68A', '#FCD34D', '#FBBF24', '#F59E0B', '#D97706', '#B45309'],
  },
  revenue: {
    key: 'revenue',
    label_km: 'ចំណូល (បញ្ជាទិញ)',
    label_en: 'Revenue (Orders)',
    unit_km: '$',
    unit_en: '$',
    format: (v) => '$' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toLocaleString()),
    colorRange: ['#0B2A1A', '#0D3B23', '#0F4D2E', '#116639', '#138033', '#0CA85A', '#0ECB81'],
  },
  orders_count: {
    key: 'orders_count',
    label_km: 'ចំនួនការកម្មង់',
    label_en: 'Order Count',
    unit_km: 'ការកម្មង់',
    unit_en: 'orders',
    format: (v) => v.toLocaleString(),
    colorRange: ['#0B1E2F', '#0D2A40', '#103654', '#1A4F7A', '#1E6CA8', '#D4A50A', '#F0B90B'],
  },
};

// --- Order Stats Interfaces ---

export interface RecentOrder {
  order_id: string;
  timestamp: string;
  grand_total: number;
  payment_status: string;
  fulfillment_status: string;
  user: string;
}

export interface ProvinceOrderStats {
  province_id: string;
  name_en: string;
  name_km: string;
  revenue: number;
  orders_count: number;
  paid_count: number;
  unpaid_count: number;
  delivered_count: number;
  pending_count: number;
  top_user: string;
  recent_orders: RecentOrder[];
}

export interface MapKPIStats {
  total_orders: number;
  total_revenue: number;
  top_province_name: string;
  top_province_revenue: number;
  covered_provinces: number;
}

export type TableSortKey = 'name' | 'orders_count' | 'revenue' | 'paid_pct' | 'delivered_pct';
export type SortDirection = 'asc' | 'desc';

// --- UI Text ---

export const UI_TEXT = {
  title_km: 'ផែនទីខេត្ត/រាជធានី កម្ពុជា',
  title_en: 'Cambodia Provinces Map',
  search_km: 'ស្វែងរកខេត្ត...',
  search_en: 'Search provinces...',
  select_km: 'ជ្រើសរើសខេត្ត',
  select_en: 'Select a Province',
  detail_km: 'ព័ត៌មានលម្អិត',
  detail_en: 'Details',
  population_km: 'ប្រជាជន',
  population_en: 'Population',
  area_km: 'ផ្ទៃក្រឡា',
  area_en: 'Area',
  gdp_km: 'GDP',
  gdp_en: 'GDP',
  unemployment_km: 'អត្រាគ្មានការងារ',
  unemployment_en: 'Unemployment Rate',
  capital_km: 'រាជធានី/ទីក្រុង',
  capital_en: 'Capital',
  sector_km: 'វិស័យសេដ្ឋកិច្ច',
  sector_en: 'Economic Sector',
  provinces_km: 'បញ្ជីខេត្ត',
  provinces_en: 'Province List',
  legend_km: 'មាត្រដ្ឋានពណ៌',
  legend_en: 'Color Legend',
  metric_km: 'សូចនកម្ម',
  metric_en: 'Metric',
  low_km: 'ទាប',
  low_en: 'Low',
  high_km: 'ខ្ពស់',
  high_en: 'High',
  lang_switch_km: 'English',
  lang_switch_en: 'ខ្មែរ',
  no_results_km: 'រកមិនឃើញខេត្ត',
  no_results_en: 'No provinces found',
  all_provinces_km: 'ខេត្តទាំងអស់',
  all_provinces_en: 'All Provinces',
  // Order stats
  orders_km: 'ការកម្មង់',
  orders_en: 'Orders',
  revenue_km: 'ចំណូល',
  revenue_en: 'Revenue',
  paid_km: 'បានបង់',
  paid_en: 'Paid',
  delivered_km: 'បានដឹកជញ្ជូន',
  delivered_en: 'Delivered',
  order_stats_km: 'ស្ថិតិការកម្មង់',
  order_stats_en: 'Order Statistics',
  table_title_km: 'ចំណាត់ថ្នាក់ខេត្ត',
  table_title_en: 'Province Ranking',
  no_orders_km: 'មិនមានទិន្នន័យការកម្មង់',
  no_orders_en: 'No order data for this province',
  recent_orders_km: 'ការកម្មង់ថ្មីៗ',
  recent_orders_en: 'Recent Orders',
  top_user_km: 'អ្នកប្រើជាន់ខ្ពស់',
  top_user_en: 'Top User',
  show_all_km: 'បង្ហាញទាំងអស់',
  show_all_en: 'Show All',
  show_active_km: 'បង្ហាញតែសកម្ម',
  show_active_en: 'Active Only',
  // KPI
  kpi_total_orders_km: 'ការកម្មង់សរុប',
  kpi_total_orders_en: 'Total Orders',
  kpi_total_revenue_km: 'ចំណូលសរុប',
  kpi_total_revenue_en: 'Total Revenue',
  kpi_top_province_km: 'ខេត្តលំដាប់ទី១',
  kpi_top_province_en: 'Top Province',
  kpi_coverage_km: 'ភាពគ្រប',
  kpi_coverage_en: 'Coverage',
};
