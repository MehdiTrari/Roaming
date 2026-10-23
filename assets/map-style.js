// An original palette and label hierarchy applied to OpenFreeMap's Liberty
// source at load time. Data, source credits, glyphs and sprites stay intact.
const categories = [
    ['food', ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'food_court', 'biergarten'], '#f39a3e', '#b96b22'],
    ['culture', ['museum', 'art_gallery', 'attraction', 'theatre', 'cinema', 'historic', 'monument', 'castle'], '#e477bd', '#b4478d'],
    ['stay', ['lodging', 'hotel', 'hostel', 'guest_house', 'motel'], '#9789df', '#7362b4'],
    ['nature', ['park', 'garden', 'zoo', 'playground', 'nature_reserve'], '#65b84c', '#438538'],
    ['health', ['hospital', 'clinic', 'doctors', 'pharmacy'], '#ee7c89', '#be5265'],
    ['shop', ['shop', 'grocery', 'supermarket', 'mall', 'bakery', 'convenience'], '#58a4e8', '#377eb6'],
    ['study', ['college', 'school', 'university', 'library'], '#bd9367', '#92704c'],
    ['rail', ['rail', 'airport', 'bus'], '#7089d8', '#506ab7'],
    ['faith', ['place_of_worship', 'church'], '#849da7', '#5c7781']
];
function categoryExpression(field) {
    return ['case', ...categories.flatMap((item, index) => [
        ['any', ['in', ['get', 'class'], ['literal', item[1]]], ['in', ['get', 'subclass'], ['literal', item[1]]]],
        field === 'icon' ? `roaming-${item[0]}` : item[field === 'color' ? 2 : 3]
    ]), field === 'icon' ? 'roaming-landmark' : '#758e9d'];
}
const label = locale => ['coalesce', ['get', locale === 'fr' ? 'name:fr' : 'name:en'], ['get', 'name'], ['get', 'name:latin'], ['get', 'name_en']];
function roadWidth(id, casing) {
    const major = /motorway|trunk_primary/.test(id), secondary = /secondary_tertiary/.test(id);
    const factor = /link|service_track/.test(id) ? .7 : 1;
    const extra = casing ? .8 : 0;
    return ['interpolate', ['exponential', 1.2], ['zoom'], 10, .6 + extra,
        14, (major ? 7 : secondary ? 5 : 3.1) * factor + extra,
        16, (major ? 14 : secondary ? 11 : 7) * factor + extra,
        20, (major ? 34 : 24) * factor + extra];
}
export function roamingMapStyle(source, locale = 'fr') {
    const layers = source.layers.map(original => {
        const layer = {...original, paint: {...original.paint}, layout: {...original.layout}};
        const {id, type} = layer, paint = layer.paint, layout = layer.layout;
        if (type === 'background') paint['background-color'] = '#fcf4ee';
        if (id === 'natural_earth') paint['raster-opacity'] = .15;
        if (id === 'landuse_residential') paint['fill-color'] = '#ffecdf';
        if (id === 'park') Object.assign(paint, {'fill-color': '#b9e6a8', 'fill-opacity': .95, 'fill-outline-color': '#a8d894'});
        if (id === 'park_outline') paint['line-color'] = '#eaf5e5';
        if (/landcover_(wood|grass)|landuse_(pitch|cemetery)/.test(id)) Object.assign(paint, {'fill-color': '#c2e3af', 'fill-opacity': .8});
        if (id === 'landuse_hospital') paint['fill-color'] = '#f7e4e7';
        if (id === 'landuse_school') paint['fill-color'] = '#f4e8dc';
        if (id === 'water') paint['fill-color'] = '#a9d9f4';
        if (id.startsWith('waterway_') && type === 'line') paint['line-color'] = '#a9d9f4';
        // Remove the dark roof grain and 3D edges seen in the default style.
        if (type === 'fill-extrusion') layout.visibility = 'none';
        if (id === 'building') {
            layer.minzoom = 15.5; delete layer.maxzoom;
            Object.assign(paint, {'fill-color': '#e4ded9', 'fill-opacity': .45});
            delete paint['fill-outline-color'];
        }
        if (id === 'road_area_pattern') { delete paint['fill-pattern']; paint['fill-color'] = '#f4eee8'; }
        if (/^(road|bridge|tunnel)_/.test(id) && type === 'line') {
            if (/rail/.test(id)) {
                paint['line-color'] = /hatching/.test(id) ? '#e3e2e6' : '#c9cbd2';
            } else if (/path_pedestrian/.test(id)) {
                paint['line-color'] = '#fffdfa';
            } else {
                const casing = id.endsWith('_casing');
                paint['line-color'] = casing ? '#b2b9cb' : /motorway|trunk_primary/.test(id) ? '#b3b7ce' : '#c6cbd9';
                paint['line-width'] = roadWidth(id, casing);
                layout['line-cap'] = 'round'; layout['line-join'] = 'round';
            }
        }
        if (type === 'symbol' && layout['text-field']) {
            layout['text-field'] = label(locale);
            layout['text-font'] = ['Noto Sans Regular'];
            Object.assign(paint, {'text-halo-color': '#fffdfa', 'text-halo-width': 1.4, 'text-halo-blur': .3});
        }
        // Keep route numbers as route numbers, not feature names.
        if (/shield/.test(id)) layout['text-field'] = original.layout['text-field'];
        if (id.startsWith('highway-name')) {
            layer.minzoom = id.endsWith('major') ? 12.2 : 13.7;
            Object.assign(layout, {'text-transform': 'uppercase', 'text-letter-spacing': .065,
                'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12, 19, 14]});
            paint['text-color'] = '#454b59';
        }
        if (id === 'label_other') {
            layout['text-font'] = ['Noto Sans Regular']; layout['text-size'] = 12;
            paint['text-color'] = '#677181';
        }
        if (/^poi_r/.test(id)) {
            layer.minzoom = id === 'poi_r1' ? 13.5 : id === 'poi_r7' ? 14.2 : 15.2;
            layer.filter = ['all', original.filter, ['!=', ['get', 'class'], 'bus'], ['any', ['has', 'name'], ['has', 'name:latin'], ['has', 'name:fr']]];
            Object.assign(layout, {'icon-image': categoryExpression('icon'), 'icon-size': .85,
                'icon-padding': 4, 'text-padding': 4, 'text-font': ['Noto Sans Regular'],
                'text-size': 11.5, 'text-offset': [0, 1], 'text-optional': false,
                'symbol-sort-key': ['coalesce', ['get', 'rank'], 100]});
            paint['text-color'] = categoryExpression('text');
        }
        // Nearby bus stops dominated the old map. Show stations first and
        // bring bus stops back when the visitor zooms into individual streets.
        if (id === 'poi_transit') {
            layer.filter = ['match', ['get', 'class'], ['rail', 'airport'], true, false];
            layer.minzoom = 12;
            Object.assign(layout, {'icon-image': 'roaming-rail', 'icon-size': .8, 'text-font': ['Noto Sans Regular'], 'text-size': 11.5});
            paint['text-color'] = '#5a73bd';
        }
        return layer;
    });
    const transit = layers.find(layer => layer.id === 'poi_transit');
    if (transit) layers.push({...transit, id: 'roaming-bus-stops', minzoom: 16.2, filter: ['==', ['get', 'class'], 'bus']});
    return {...source, name: 'Roaming Pastel', layers};
}

const pictograms = {
    food: ['M7 6v6m3-6v6M7 9h3m-1.5 3v6M16 6c-3 3-3 6 0 6V6Zm0 6v6'],
    culture: ['m5 9 7-4 7 4H5Zm2 3v5m5-5v5m5-5v5M5 19h14'],
    stay: ['M5 17V8m0 6h14v3M6 11h5v3m0-4h6l2 4'],
    nature: ['m12 5-5 6h3l-4 4h5v4m1-14 5 6h-3l4 4h-6'],
    health: ['M10 5h4v5h5v4h-5v5h-4v-5H5v-4h5V5Z'],
    shop: ['M6 9h12l1 10H5L6 9Zm3 0V7a3 3 0 0 1 6 0v2'],
    study: ['m4 10 8-5 8 5-8 4-8-4Zm4 3v4l4 2 4-2v-4m4-3v6'],
    rail: ['M8 5h8a2 2 0 0 1 2 2v9H6V7a2 2 0 0 1 2-2Zm-2 6h12M8 19l2-3m6 3-2-3M9 14h.1m5.9 0h.1'],
    faith: ['M12 5v14m-5-9h10'],
    landmark: ['M12 5a5 5 0 0 1 5 5c0 4-5 9-5 9s-5-5-5-9a5 5 0 0 1 5-5Zm0 3v4']
};
export function registerRoamingMapIcons(map) {
    map.on('styleimagemissing', ({id}) => {
        if (!id.startsWith('roaming-') || map.hasImage(id)) return;
        const category = id.slice(8), paths = pictograms[category];
        if (!paths) return;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.scale(2, 2); context.beginPath(); context.arc(12, 12, 10.5, 0, 2 * Math.PI);
        context.fillStyle = categories.find(item => item[0] === category)?.[2] || '#849ba8';
        context.fill(); context.strokeStyle = '#fff'; context.lineWidth = 1.4; context.stroke();
        context.lineWidth = 1.45; context.lineCap = context.lineJoin = 'round';
        paths.forEach(path => context.stroke(new Path2D(path)));
        map.addImage(id, context.getImageData(0, 0, 48, 48), {pixelRatio: 2});
    });
}
