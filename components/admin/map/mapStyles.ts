
export const MAP_COLORS = {
    base: '#000000', // Black
    highlight: '#00f0ff', // Electric Cyan
    levels: [
        '#001015', // 0 - Very Dark Cyan
        '#00202b', // 1
        '#003547', // 2
        '#004d61', // 3
        '#006880', // 4
        '#0085a1', // 5
        '#00a6c2'  // 6 - Bright Cyan
    ]
};

export const REVENUE_LEVELS = [0, 500, 2000, 5000, 10000, 25000];

export const EXTRUSION_HEIGHT_EXPRESSION = [
    'interpolate',
    ['linear'],
    ['get', 'revenue'],
    0, 50,
    500, 500,
    5000, 2000,
    10000, 5000,
    50000, 15000 
];

// Mostly transparent fill, relying on lines
export const FILL_COLOR_EXPRESSION = [
    'case',
    ['!=', ['get', 'revenue'], 0],
    [
        'step',
        ['get', 'revenue'],
        '#001015',
        REVENUE_LEVELS[1], '#001820',
        REVENUE_LEVELS[2], '#00202b',
        REVENUE_LEVELS[3], '#002a38',
        REVENUE_LEVELS[4], '#003547',
        REVENUE_LEVELS[5], '#00455c'
    ],
    '#000000' // Black for empty
];
