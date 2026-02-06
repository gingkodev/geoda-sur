import { DEV_MODE, devCoords } from '../dev.js';

export function getPosition() {
	if (DEV_MODE) {
		return Promise.resolve(devCoords());
	}

	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Geolocation not supported'));
			return;
		}

		console.log('[geo] requesting position...');
		console.log('[geo] permissions API:', !!navigator.permissions);

		if (navigator.permissions) {
			navigator.permissions.query({ name: 'geolocation' }).then((result) => {
				console.log('[geo] permission state:', result.state);
			});
		}

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				console.log('[geo] success:', pos.coords.latitude, pos.coords.longitude, 'accuracy:', pos.coords.accuracy);
				resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
			},
			(err) => {
				console.error('[geo] error code:', err.code, 'message:', err.message);
				console.error('[geo] 1=PERMISSION_DENIED 2=POSITION_UNAVAILABLE 3=TIMEOUT');
				reject(err);
			},
			{ enableHighAccuracy: false, timeout: 10000 }
		);
	});
}

export async function getPositionByIP() {
	console.log('[geo] attempting IP-based fallback...');
	const res = await fetch('https://ipapi.co/json/');
	if (!res.ok) throw new Error(`IP geolocation failed: ${res.status}`);
	const data = await res.json();
	console.log('[geo] IP fallback:', data.latitude, data.longitude, `(${data.city}, ${data.country_name})`);
	return { lat: data.latitude, lon: data.longitude };
}
