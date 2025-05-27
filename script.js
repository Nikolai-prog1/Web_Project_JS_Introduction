let counter = 0;
let animals = [];
let bufferLayer;
let layerBindings = [];
let conflictZones = [];
let showConflicts = false;

const speciesColors = {
    'Кафява мечка': 'red', 'Сив вълк': 'gray', 'Чакал': 'green', 'Лисица': 'orange', 'Европейска дива котка': 'black', 'Рис': 'purple', 'Язовец': 'brown', 'Златка': 'gold', 'Невестулка': 'sandybrown', 'Пъстър пор': 'cyan', 'Степен пор': 'white', 'Видра': 'pink', 'Тюлен монах': 'blue'
};
const speciesRanges = {
    'Кафява мечка': 10, 'Сив вълк': 8, 'Чакал': 2, 'Лисица': 2, 'Европейска дива котка': 1.5, 'Рис': 7, 'Язовец': 1, 'Златка': 1, 'Невестулка': 1, 'Пъстър пор': 1.5, 'Степен пор': 2, 'Видра': 2, 'Тюлен монах': 4
};
const speciesStatuses = {
    'Кафява мечка': 'Уязвим (VU)', 'Сив вълк': 'Уязвим (VU)', 'Чакал': 'Не е застрашен', 'Лисица': 'Не е застрашен', 'Европейска дива котка': 'Не е застрашен', 'Рис': 'Уязвим (VU)', 'Язовец': 'dark-brown', 'Златка': 'Застрашен (EN)', 'Невестулка': 'Не е застрашен', 'Пъстър пор': 'Уязвим (VU)', 'Степен пор': 'Уязвим (VU)', 'Видра': 'Уязвим (VU)', 'Тюлен монах': 'Изчезнал (EX)'
};

function addAnimal(animal) {
    animals.push(animal);
    drawTerritories();
    updateTable();
}

function updateTable() {
    const tbody = document.querySelector("#animalTable tbody");
    tbody.innerHTML = '';
    animals.forEach((a, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${a.species}</td><td>${a.identifier}</td><td>${a.radius} км</td><td>${a.status}</td><td><button onclick="deleteAnimal(${i})">❌</button></td>`;
        tbody.appendChild(tr);
    });
}

function deleteAnimal(index) {
    const removedAnimal = animals.splice(index, 1)[0];

    layerBindings.forEach(({ layer, animal }) => {
        if (animal === removedAnimal) {
            map.removeLayer(layer);
        }
    });

    layerBindings = layerBindings.filter(b => b.animal !== removedAnimal);

    updateTable();
    if (bufferLayer) map.removeLayer(bufferLayer);

    if (showConflicts) checkTerritoryConflicts(false);
}

function generateSequentialUniqueNumber() {
    const base = Date.now();
    return `${base}${(counter++).toString().padStart(4, '0')}`;
}

document.getElementById('animalForm').addEventListener('submit', e => {
    e.preventDefault();
    map.once('click', e => {
        let speciesName = document.getElementById('species').value;

        const animal = {
            species: speciesName,
            identifier: speciesName + generateSequentialUniqueNumber(),
            radius: speciesRanges[speciesName],
            status: speciesStatuses[speciesName],
            coords: [e.latlng.lat, e.latlng.lng]
        };
        addAnimal(animal);
    });
    alert("Кликни на картата, за да поставиш наблюдението.");
});

function createBuffer() {
    if (bufferLayer) {
        map.removeLayer(bufferLayer);
        bufferLayer = null;
        return;
    }

    if (animals.length === 0) return;

    const last = animals[animals.length - 1];
    const point = turf.point([last.coords[1], last.coords[0]]);
    const buffered = turf.buffer(point, 1, { units: 'kilometers' });
    bufferLayer = L.geoJSON(buffered, { color: 'red', fillOpacity: 0.1 }).addTo(map);
}

function drawTerritories() {
    layerBindings.forEach(b => map.removeLayer(b.layer));
    layerBindings = [];

    animals.forEach(animal => {
        const color = speciesColors[animal.species];

        const marker = L.circleMarker(animal.coords, {
            color: color, radius: 5, fillOpacity: 0.9, pane: 'markerPane'
        }).bindPopup(`<b>${animal.species}</b><br>ID: ${animal.identifier}`).addTo(map);

        const buffer = turf.buffer(turf.point([animal.coords[1], animal.coords[0]]), animal.radius, { units: 'kilometers' });
        const bufferLayer = L.geoJSON(buffer, { color: color, fillOpacity: 0.2 }).addTo(map);

        layerBindings.push({ layer: marker, animal });
        layerBindings.push({ layer: bufferLayer, animal });
    });
}

function filterSpecies() {
    const selected = document.getElementById('species').value;
    conflictZones.forEach(layer => map.removeLayer(layer));
    conflictZones = [];
    layerBindings.forEach(({ layer, animal }) => {
        if (animal.species !== selected) {
            map.removeLayer(layer);
        } else {
            map.addLayer(layer);
        }
    });
}

function resetMap() {
    showConflicts = false;
    layerBindings.forEach(({ layer }) => layer.addTo(map));
    conflictZones.forEach(layer => map.removeLayer(layer));
    conflictZones = [];
    if (bufferLayer) map.removeLayer(bufferLayer);
}

function checkTerritoryConflicts(showAlert) {
    conflictZones.forEach(layer => map.removeLayer(layer));
    conflictZones = [];

    showConflicts = true;

    let conflictCount = 0;
    for (let i = 0; i < animals.length; i++) {
        const a = turf.buffer(turf.point([animals[i].coords[1], animals[i].coords[0]]), animals[i].radius, { units: 'kilometers' });
        for (let j = i + 1; j < animals.length; j++) {
            const b = turf.buffer(turf.point([animals[j].coords[1], animals[j].coords[0]]), animals[j].radius, { units: 'kilometers' });
            if (turf.booleanIntersects(a, b)) {
                const intersection = turf.intersect(a, b);
                if (intersection) {
                    const conflictLayer = L.geoJSON(intersection, { color: 'red', fillOpacity: 0.4 }).addTo(map);
                    conflictZones.push(conflictLayer);
                    conflictCount++;
                }
            }
        }
    }
    if (showAlert) {
        if (conflictCount > 0) {
            alert(`${conflictCount} конфликт(а) засечени.`);
        }
        else {
            alert('Няма засечени конфликти.');
        }
    }
}