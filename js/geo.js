//import { DEV_MODE, devCoords } from '../dev.js';

export function getPosition() {
	//if (DEV_MODE) {
	//  return Promise.resolve(devCoords());
	//}

	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Geolocation not supported'));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
			(err) => reject(err),
			{ enableHighAccuracy: false, timeout: 10000 }
		);
	});
}
