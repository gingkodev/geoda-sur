export const POST = "#f7a0a1";
export const AUDIO = "#dab58d";
export const NOTE = "#d6d0c5";
export const HOVER_BG = "#f5f3ef";

export const PALETTE = [POST, AUDIO, NOTE, HOVER_BG];

export const codes: string[] = [
	"a09f9f", "4b54a2", "f7a0a1", "a4a9ac", "2c2527",
	"f5faf3", "d6d0c5", "dab58d", "b5a5a5", "6f769d",
];

// Perceived brightness (ITU-R BT.601). Returns true if the color is dark enough
// that light text reads better than dark text against it.
export const isDark = (hex: string, threshold: number = 140): boolean => {
	const h = hex.replace("#", "");
	const r = parseInt(h.substring(0, 2), 16);
	const g = parseInt(h.substring(2, 4), 16);
	const b = parseInt(h.substring(4, 6), 16);
	return (0.299 * r + 0.587 * g + 0.114 * b) < threshold;
};

export const getRandomHex = (hexList: string[], threshold: number = 50): string => {
	const filtered = hexList.filter(hex => {
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		const brightness = (r + g + b) / 3;
		return brightness > threshold;
	});

	if (filtered.length === 0) return "ffffff";

	const randomIndex = Math.floor(Math.random() * filtered.length);
	return `#${filtered[randomIndex]}`;
};
