// Matching wood, moss, oyster and mushroom-cap colours for Konva drawings.
export const canvasPalettes = {
  light: {
    garden: '#d7dfc1', gardenGrid: '#a7b58f', gardenBorder: '#697750',
    bed: '#9d704d', bedBorder: '#644631', soil: '#d7b58d', soilGrid: 'rgba(64,44,28,0.32)',
    selected: '#f3ddb1', handle: '#fffcf6', label: '#fffcf6', labelText: '#28221c',
    name: '#fffcf6', nameOutline: '#38271c', borderGuide: '#38616d', neighbourGuide: '#7d5427',
    alignment: '#86536d', warning: '#923f32',
    plants: ['#365039', '#38616d', '#80552c', '#864f47', '#735570', '#516b45'],
  },
  dark: {
    garden: '#28372a', gardenGrid: '#425740', gardenBorder: '#819a70',
    bed: '#765338', bedBorder: '#b78d62', soil: '#60452f', soilGrid: 'rgba(238,228,213,0.28)',
    selected: '#f3ddb1', handle: '#eee4d5', label: '#28221c', labelText: '#eee4d5',
    name: '#fffcf6', nameOutline: '#38271c', borderGuide: '#9ec5c7', neighbourGuide: '#e1bd76',
    alignment: '#d7a5bd', warning: '#e7aa96',
    plants: ['#b3cda3', '#9ec5c7', '#e1bd76', '#e7aa96', '#d7a5bd', '#cbd6af'],
  },
};
export const canvasPalette = (dark: boolean) => canvasPalettes[dark ? 'dark' : 'light'];
