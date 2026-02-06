export const DEV_MODE = false;

const PRESETS = {
	reykjavik: { lat: 64.1466, lon: -21.9426 },
	dubai: { lat: 25.2048, lon: 55.2708 },
	singapore: { lat: 1.3521, lon: 103.8198 },
	denver: { lat: 39.7392, lon: -104.9903 },
};

let activePreset = 'reykjavik';

export function setPreset(name) {
	if (PRESETS[name]) activePreset = name;
}

export function devCoords() {
	return { ...PRESETS[activePreset] };
}
