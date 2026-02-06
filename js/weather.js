export async function fetchWeather(lat, lon) {
	const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
		+ `&current=temperature_2m,relative_humidity_2m,surface_pressure,cloud_cover,precipitation,wind_speed_10m`;

	const res = await fetch(url);
	if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
	const data = await res.json();
	const c = data.current;
	console.log(c);
	return {
		temperature: c.temperature_2m,
		humidity: c.relative_humidity_2m,
		windSpeed: c.wind_speed_10m,
		pressure: c.surface_pressure,
		cloudCover: c.cloud_cover,
		precipitation: c.precipitation,
	};
}
