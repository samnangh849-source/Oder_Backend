/**
 * Cambodia Provinces Data
 * Comprehensive dataset for all 25 provinces/municipalities of Cambodia
 * Supports Khmer (km) and English (en) localization
 */

export interface CambodiaProvince {
  province_id: string;
  name_kh: string;
  name_en: string;
  capital_kh: string;
  capital_en: string;
  area_km2: number;
  population: number;
  gdp_usd: number; // estimated GDP in millions USD
  unemployment_rate: number; // percentage
  main_economic_sector_kh: string;
  main_economic_sector_en: string;
  iso_code: string;
  lat: number;
  lng: number;
}

export const CAMBODIA_PROVINCES: CambodiaProvince[] = [
  {
    province_id: 'phnompenh',
    name_kh: 'រាជធានីភ្នំពេញ',
    name_en: 'Phnom Penh',
    capital_kh: 'ភ្នំពេញ',
    capital_en: 'Phnom Penh',
    area_km2: 679,
    population: 2281000,
    gdp_usd: 12500,
    unemployment_rate: 1.8,
    main_economic_sector_kh: 'សេវាកម្ម និងពាណិជ្ជកម្ម',
    main_economic_sector_en: 'Services & Commerce',
    iso_code: 'KH-12',
    lat: 11.5564,
    lng: 104.9282,
  },
  {
    province_id: 'banteymeanchey',
    name_kh: 'ខេត្តបន្ទាយមានជ័យ',
    name_en: 'Banteay Meanchey',
    capital_kh: 'សិរីសោភ័ណ',
    capital_en: 'Sisophon',
    area_km2: 6679,
    population: 860000,
    gdp_usd: 980,
    unemployment_rate: 3.2,
    main_economic_sector_kh: 'កសិកម្ម និងពាណិជ្ជកម្មព្រំដែន',
    main_economic_sector_en: 'Agriculture & Border Trade',
    iso_code: 'KH-1',
    lat: 13.5853,
    lng: 102.9690,
  },
  {
    province_id: 'battambang',
    name_kh: 'ខេត្តបាត់ដំបង',
    name_en: 'Battambang',
    capital_kh: 'បាត់ដំបង',
    capital_en: 'Battambang',
    area_km2: 11702,
    population: 1060000,
    gdp_usd: 1450,
    unemployment_rate: 2.5,
    main_economic_sector_kh: 'កសិកម្ម (ស្រូវ)',
    main_economic_sector_en: 'Agriculture (Rice)',
    iso_code: 'KH-2',
    lat: 13.1023,
    lng: 103.1986,
  },
  {
    province_id: 'kampongcham',
    name_kh: 'ខេត្តកំពង់ចាម',
    name_en: 'Kampong Cham',
    capital_kh: 'កំពង់ចាម',
    capital_en: 'Kampong Cham',
    area_km2: 4549,
    population: 980000,
    gdp_usd: 890,
    unemployment_rate: 2.8,
    main_economic_sector_kh: 'កសិកម្ម និងឧស្សាហកម្មកៅស៊ូ',
    main_economic_sector_en: 'Agriculture & Rubber',
    iso_code: 'KH-3',
    lat: 11.9920,
    lng: 105.4636,
  },
  {
    province_id: 'kampongchhnang',
    name_kh: 'ខេត្តកំពង់ឆ្នាំង',
    name_en: 'Kampong Chhnang',
    capital_kh: 'កំពង់ឆ្នាំង',
    capital_en: 'Kampong Chhnang',
    area_km2: 5521,
    population: 530000,
    gdp_usd: 420,
    unemployment_rate: 3.5,
    main_economic_sector_kh: 'នេសាទ និងកសិកម្ម',
    main_economic_sector_en: 'Fishing & Agriculture',
    iso_code: 'KH-4',
    lat: 12.2502,
    lng: 104.6694,
  },
  {
    province_id: 'kampongspeu',
    name_kh: 'ខេត្តកំពង់ស្ពឺ',
    name_en: 'Kampong Speu',
    capital_kh: 'កំពង់ស្ពឺ',
    capital_en: 'Kampong Speu',
    area_km2: 7017,
    population: 870000,
    gdp_usd: 680,
    unemployment_rate: 3.1,
    main_economic_sector_kh: 'កសិកម្ម និងឧស្សាហកម្មស្រាល',
    main_economic_sector_en: 'Agriculture & Light Industry',
    iso_code: 'KH-5',
    lat: 11.4519,
    lng: 104.5190,
  },
  {
    province_id: 'kampongthom',
    name_kh: 'ខេត្តកំពង់ធំ',
    name_en: 'Kampong Thom',
    capital_kh: 'កំពង់ធំ',
    capital_en: 'Kampong Thom',
    area_km2: 13814,
    population: 710000,
    gdp_usd: 620,
    unemployment_rate: 3.0,
    main_economic_sector_kh: 'កសិកម្ម និងទេសចរណ៍',
    main_economic_sector_en: 'Agriculture & Tourism',
    iso_code: 'KH-6',
    lat: 12.7072,
    lng: 104.8890,
  },
  {
    province_id: 'kampot',
    name_kh: 'ខេត្តកំពត',
    name_en: 'Kampot',
    capital_kh: 'កំពត',
    capital_en: 'Kampot',
    area_km2: 4873,
    population: 620000,
    gdp_usd: 540,
    unemployment_rate: 2.9,
    main_economic_sector_kh: 'កសិកម្ម (ម្រេច) និងទេសចរណ៍',
    main_economic_sector_en: 'Agriculture (Pepper) & Tourism',
    iso_code: 'KH-7',
    lat: 10.5930,
    lng: 104.1640,
  },
  {
    province_id: 'kandal',
    name_kh: 'ខេត្តកណ្ដាល',
    name_en: 'Kandal',
    capital_kh: 'តាខ្មៅ',
    capital_en: 'Ta Khmau',
    area_km2: 3568,
    population: 1250000,
    gdp_usd: 1680,
    unemployment_rate: 2.2,
    main_economic_sector_kh: 'ឧស្សាហកម្ម និងកសិកម្ម',
    main_economic_sector_en: 'Industry & Agriculture',
    iso_code: 'KH-8',
    lat: 11.2227,
    lng: 105.0010,
  },
  {
    province_id: 'kep',
    name_kh: 'ខេត្តកែប',
    name_en: 'Kep',
    capital_kh: 'កែប',
    capital_en: 'Kep',
    area_km2: 336,
    population: 42000,
    gdp_usd: 85,
    unemployment_rate: 2.4,
    main_economic_sector_kh: 'ទេសចរណ៍ និងនេសាទ',
    main_economic_sector_en: 'Tourism & Fishing',
    iso_code: 'KH-23',
    lat: 10.4833,
    lng: 104.3167,
  },
  {
    province_id: 'kohkong',
    name_kh: 'ខេត្តកោះកុង',
    name_en: 'Koh Kong',
    capital_kh: 'ខេមរភូមិន្ទ',
    capital_en: 'Khemarak Phoumin',
    area_km2: 11160,
    population: 140000,
    gdp_usd: 280,
    unemployment_rate: 3.8,
    main_economic_sector_kh: 'នេសាទ និងទេសចរណ៍អេកូ',
    main_economic_sector_en: 'Fishing & Eco-Tourism',
    iso_code: 'KH-9',
    lat: 11.6089,
    lng: 103.0356,
  },
  {
    province_id: 'kratie',
    name_kh: 'ខេត្តក្រចេះ',
    name_en: 'Kratie',
    capital_kh: 'ក្រចេះ',
    capital_en: 'Kratie',
    area_km2: 11094,
    population: 370000,
    gdp_usd: 310,
    unemployment_rate: 3.4,
    main_economic_sector_kh: 'កសិកម្ម និងកៅស៊ូ',
    main_economic_sector_en: 'Agriculture & Rubber',
    iso_code: 'KH-10',
    lat: 12.4880,
    lng: 106.0190,
  },
  {
    province_id: 'mondulkiri',
    name_kh: 'ខេត្តមណ្ឌលគិរី',
    name_en: 'Mondulkiri',
    capital_kh: 'សែនមនោរម្យ',
    capital_en: 'Sen Monorom',
    area_km2: 14288,
    population: 93000,
    gdp_usd: 110,
    unemployment_rate: 4.2,
    main_economic_sector_kh: 'ទេសចរណ៍អេកូ និងកសិកម្ម',
    main_economic_sector_en: 'Eco-Tourism & Agriculture',
    iso_code: 'KH-11',
    lat: 12.4511,
    lng: 107.1879,
  },
  {
    province_id: 'oddarmeanchey',
    name_kh: 'ខេត្តឧត្តរមានជ័យ',
    name_en: 'Oddar Meanchey',
    capital_kh: 'សំរោង',
    capital_en: 'Samraong',
    area_km2: 6158,
    population: 270000,
    gdp_usd: 210,
    unemployment_rate: 3.7,
    main_economic_sector_kh: 'កសិកម្ម និងព្រៃឈើ',
    main_economic_sector_en: 'Agriculture & Forestry',
    iso_code: 'KH-22',
    lat: 14.1591,
    lng: 103.7227,
  },
  {
    province_id: 'pailin',
    name_kh: 'ខេត្តប៉ៃលិន',
    name_en: 'Pailin',
    capital_kh: 'ប៉ៃលិន',
    capital_en: 'Pailin',
    area_km2: 803,
    population: 75000,
    gdp_usd: 95,
    unemployment_rate: 3.0,
    main_economic_sector_kh: 'រ៉ែ និងកសិកម្ម',
    main_economic_sector_en: 'Mining & Agriculture',
    iso_code: 'KH-24',
    lat: 12.8491,
    lng: 102.6097,
  },
  {
    province_id: 'preahsihanouk',
    name_kh: 'ខេត្តព្រះសីហនុ',
    name_en: 'Preah Sihanouk',
    capital_kh: 'ព្រះសីហនុ',
    capital_en: 'Sihanoukville',
    area_km2: 868,
    population: 310000,
    gdp_usd: 1850,
    unemployment_rate: 2.0,
    main_economic_sector_kh: 'ទេសចរណ៍ និងអចលនទ្រព្យ',
    main_economic_sector_en: 'Tourism & Real Estate',
    iso_code: 'KH-18',
    lat: 10.6273,
    lng: 103.5220,
  },
  {
    province_id: 'preahvihear',
    name_kh: 'ខេត្តព្រះវិហារ',
    name_en: 'Preah Vihear',
    capital_kh: 'ត្បែងមានជ័យ',
    capital_en: 'Tbeng Meanchey',
    area_km2: 13788,
    population: 255000,
    gdp_usd: 195,
    unemployment_rate: 4.0,
    main_economic_sector_kh: 'កសិកម្ម និងទេសចរណ៍បេតិកភណ្ឌ',
    main_economic_sector_en: 'Agriculture & Heritage Tourism',
    iso_code: 'KH-13',
    lat: 13.7924,
    lng: 104.9828,
  },
  {
    province_id: 'preyveng',
    name_kh: 'ខេត្តព្រៃវែង',
    name_en: 'Prey Veng',
    capital_kh: 'ព្រៃវែង',
    capital_en: 'Prey Veng',
    area_km2: 4883,
    population: 1000000,
    gdp_usd: 720,
    unemployment_rate: 3.2,
    main_economic_sector_kh: 'កសិកម្ម (ស្រូវ)',
    main_economic_sector_en: 'Agriculture (Rice)',
    iso_code: 'KH-14',
    lat: 11.4844,
    lng: 105.3244,
  },
  {
    province_id: 'pursat',
    name_kh: 'ខេត្តពោធិ៍សាត់',
    name_en: 'Pursat',
    capital_kh: 'ពោធិ៍សាត់',
    capital_en: 'Pursat',
    area_km2: 12692,
    population: 430000,
    gdp_usd: 360,
    unemployment_rate: 3.3,
    main_economic_sector_kh: 'កសិកម្ម និងនេសាទទឹកសាប',
    main_economic_sector_en: 'Agriculture & Freshwater Fishing',
    iso_code: 'KH-15',
    lat: 12.5337,
    lng: 103.9179,
  },
  {
    province_id: 'ratanakiri',
    name_kh: 'ខេត្តរតនគិរី',
    name_en: 'Ratanakiri',
    capital_kh: 'បានលុង',
    capital_en: 'Banlung',
    area_km2: 10782,
    population: 220000,
    gdp_usd: 175,
    unemployment_rate: 4.5,
    main_economic_sector_kh: 'កសិកម្ម និងទេសចរណ៍អេកូ',
    main_economic_sector_en: 'Agriculture & Eco-Tourism',
    iso_code: 'KH-16',
    lat: 13.7333,
    lng: 106.9870,
  },
  {
    province_id: 'siemreap',
    name_kh: 'ខេត្តសៀមរាប',
    name_en: 'Siem Reap',
    capital_kh: 'សៀមរាប',
    capital_en: 'Siem Reap',
    area_km2: 10299,
    population: 1020000,
    gdp_usd: 2200,
    unemployment_rate: 2.1,
    main_economic_sector_kh: 'ទេសចរណ៍ (អង្គរ)',
    main_economic_sector_en: 'Tourism (Angkor)',
    iso_code: 'KH-17',
    lat: 13.3633,
    lng: 103.8600,
  },
  {
    province_id: 'stungtreng',
    name_kh: 'ខេត្តស្ទឹងត្រែង',
    name_en: 'Stung Treng',
    capital_kh: 'ស្ទឹងត្រែង',
    capital_en: 'Stung Treng',
    area_km2: 11092,
    population: 165000,
    gdp_usd: 135,
    unemployment_rate: 4.1,
    main_economic_sector_kh: 'នេសាទ និងកសិកម្ម',
    main_economic_sector_en: 'Fishing & Agriculture',
    iso_code: 'KH-19',
    lat: 13.5197,
    lng: 105.9700,
  },
  {
    province_id: 'svayrieng',
    name_kh: 'ខេត្តស្វាយរៀង',
    name_en: 'Svay Rieng',
    capital_kh: 'ស្វាយរៀង',
    capital_en: 'Svay Rieng',
    area_km2: 2966,
    population: 530000,
    gdp_usd: 650,
    unemployment_rate: 2.6,
    main_economic_sector_kh: 'ឧស្សាហកម្ម (SEZ) និងកសិកម្ម',
    main_economic_sector_en: 'Industry (SEZ) & Agriculture',
    iso_code: 'KH-20',
    lat: 11.0879,
    lng: 105.7987,
  },
  {
    province_id: 'takeo',
    name_kh: 'ខេត្តតាកែវ',
    name_en: 'Takeo',
    capital_kh: 'ដូនកែវ',
    capital_en: 'Doun Kaev',
    area_km2: 3563,
    population: 890000,
    gdp_usd: 680,
    unemployment_rate: 2.7,
    main_economic_sector_kh: 'កសិកម្ម (ស្រូវ) និងនេសាទ',
    main_economic_sector_en: 'Agriculture (Rice) & Fishing',
    iso_code: 'KH-21',
    lat: 10.9908,
    lng: 104.7986,
  },
  {
    province_id: 'tbongkhmum',
    name_kh: 'ខេត្តត្បូងឃ្មុំ',
    name_en: 'Tboung Khmum',
    capital_kh: 'សួង',
    capital_en: 'Suong',
    area_km2: 4928,
    population: 780000,
    gdp_usd: 580,
    unemployment_rate: 3.0,
    main_economic_sector_kh: 'កសិកម្ម និងកៅស៊ូ',
    main_economic_sector_en: 'Agriculture & Rubber',
    iso_code: 'KH-25',
    lat: 12.0500,
    lng: 105.8500,
  },
];

/** Lookup map by province_id for quick access */
export const PROVINCE_MAP: Record<string, CambodiaProvince> = {};
CAMBODIA_PROVINCES.forEach(p => { PROVINCE_MAP[p.province_id] = p; });

/** Get province display name by language */
export const getProvinceName = (province: CambodiaProvince, lang: 'en' | 'km' = 'km'): string => {
  return lang === 'km' ? province.name_kh : province.name_en;
};

/** Get province capital by language */
export const getProvinceCapital = (province: CambodiaProvince, lang: 'en' | 'km' = 'km'): string => {
  return lang === 'km' ? province.capital_kh : province.capital_en;
};

/** Get province economic sector by language */
export const getProvinceSector = (province: CambodiaProvince, lang: 'en' | 'km' = 'km'): string => {
  return lang === 'km' ? province.main_economic_sector_kh : province.main_economic_sector_en;
};

/** Format number with Khmer or English locale */
export const formatNumber = (value: number, lang: 'en' | 'km' = 'en'): string => {
  return value.toLocaleString(lang === 'km' ? 'km-KH' : 'en-US');
};

/** Format area (km2) */
export const formatArea = (km2: number, lang: 'en' | 'km' = 'en'): string => {
  return `${formatNumber(km2, lang)} km\u00B2`;
};

/** Format population */
export const formatPopulation = (pop: number, lang: 'en' | 'km' = 'en'): string => {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(2)}M`;
  if (pop >= 1000) return `${(pop / 1000).toFixed(0)}K`;
  return formatNumber(pop, lang);
};

/** Format GDP */
export const formatGDP = (gdpMillions: number): string => {
  if (gdpMillions >= 1000) return `$${(gdpMillions / 1000).toFixed(1)}B`;
  return `$${gdpMillions.toLocaleString()}M`;
};

/** Metric definitions for map color scales */
export type ProvinceMetric = 'population' | 'area_km2' | 'gdp_usd' | 'unemployment_rate' | 'revenue' | 'orders';

export const METRIC_CONFIG: Record<string, { label_km: string; label_en: string; unit: string; format: (v: number) => string }> = {
  revenue: { label_km: 'ចំណូល', label_en: 'Revenue', unit: '$', format: (v) => `$${v.toLocaleString()}` },
  orders: { label_km: 'ការកម្មង់', label_en: 'Orders', unit: '', format: (v) => v.toLocaleString() },
  population: { label_km: 'ប្រជាជន', label_en: 'Population', unit: '', format: formatPopulation },
  area_km2: { label_km: 'ផ្ទៃដី', label_en: 'Area', unit: 'km\u00B2', format: (v) => formatArea(v) },
  gdp_usd: { label_km: 'GDP', label_en: 'GDP', unit: '$M', format: formatGDP },
  unemployment_rate: { label_km: 'អត្រាគ្មានការងារ', label_en: 'Unemployment', unit: '%', format: (v) => `${v.toFixed(1)}%` },
};
