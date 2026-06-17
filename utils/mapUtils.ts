
/// <reference types="vite/client" />

/// <reference types="vite/client" />

// Get the base URL from Vite environment variables (handles both dev and prod/GitHub Pages)
const BASE_URL = import.meta.env.BASE_URL;

export const GEOJSON_URLS = [
    // Construct the path relative to the app's base URL
    `${BASE_URL}cambodia-provinces.geojson`,
    "https://raw.githubusercontent.com/seanghai/cambodia-geojson/master/cambodia-provinces.geojson",
    "https://raw.githubusercontent.com/romnea/cambodia-geojson/master/provinces.geojson",
    "https://raw.githubusercontent.com/kheang-hong/cambodia-geojson/master/provinces.geojson"
];

export const COLOR_PALETTE = ['#1f2937', '#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
export const REVENUE_THRESHOLDS = [0, 500, 1000, 5000, 10000, 20000];

export const normalizeName = (name: string) => {
    if (!name) return "";
    const cleanName = String(name).toLowerCase()
        .replace(/\s/g, '')
        .replace(/province|city|krong|khan|រាជធានី|ខេត្ត|ខេត្ដ|ក្រុង/g, '') // Added variations
        .trim();

    const KH_TO_EN_MAP: Record<string, string> = {
        'ភ្នំពេញ': 'phnompenh',
        'កណ្តាល': 'kandal', 'កណ្ដាល': 'kandal',
        'កំពង់ចាម': 'kampongcham',
        'កំពង់ឆ្នាំង': 'kampongchhnang',
        'កំពង់ធំ': 'kampongthom',
        'កំពង់ស្ពឺ': 'kampongspeu',
        'កំពត': 'kampot',
        'កែប': 'kep',
        'កោះកុង': 'kohkong',
        'ក្រចេះ': 'kratie',
        'តាកែវ': 'takeo',
        'ត្បូងឃ្មុំ': 'tbongkhmum',
        'បន្ទាយមានជ័យ': 'banteymeanchey', // GeoJSON spelling
        'បាត់ដំបង': 'battambang',
        'ប៉ៃលិន': 'pailin',
        'ពោធិ៍សាត់': 'pursat',
        'ព្រៃវែង': 'preyveng',
        'ព្រះវិហារ': 'preahvihear',
        'ព្រះសីហនុ': 'preahsihanouk',
        'មណ្ឌលគិរី': 'mondulkiri',
        'រតនគិរី': 'ratanakiri',
        'សៀមរាប': 'siemreap',
        'ស្ទឹងត្រែង': 'stungtreng',
        'ស្វាយរៀង': 'svayrieng',
        'ឧត្តរមានជ័យ': 'oddarmeanchey'
    };

    return KH_TO_EN_MAP[cleanName] || cleanName;
};
