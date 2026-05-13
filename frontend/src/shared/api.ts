import { langParam } from "./i18n";

// --- Types ---

export interface FeedItem {
	id: number;
	type: "blog" | "project" | "service";
	title: string;
	image: string | null;
	date_created: string;
	slug: string;
	link: string;
}

export interface FeedResponse {
	data: FeedItem[];
	total: number;
	limit: number;
	offset: number;
}

export interface Project {
	id: number;
	name: string;
	writeup: string;
	img_url: string;
	audio_url: string | null;
	service_ids: number[];
	date_created: string;
}

export interface BlogEntry {
	id: number;
	title: string;
	slug: string;
	category: string;
	type: "post" | "audio" | "note";
	writeup: string | null;
	audio_url: string | null;
	date_created: string;
}

export interface BlogResponse {
	data: BlogEntry[];
	total: number;
	limit: number;
	offset: number;
}

export interface Service {
	id: number;
	name: string;
	description: string;
	date_created: string;
}

export interface ServiceDetail {
	service: Service;
	projects: Project[];
}

// --- Fetch wrappers ---

function addLang(url: string): string {
	const sep = url.includes("?") ? "&" : "?";
	return `${url}${sep}${langParam}`;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function get<T>(url: string): Promise<T> {
	const fullUrl = addLang(url);
	const cacheKey = `api_cache:${fullUrl}`;
	const cached = sessionStorage.getItem(cacheKey);
	if (cached) {
		const { data, timestamp } = JSON.parse(cached);
		if (Date.now() - timestamp < CACHE_TTL) return data as T;
	}
	const res = await fetch(fullUrl);
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
	const data = await res.json();
	try {
		sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
	} catch { /* storage full, no-op */ }
	return data;
}

export function getFeed(offset = 0, limit = 40): Promise<FeedResponse> {
	return get(`/api/feed?offset=${offset}&limit=${limit}`);
}

export function getProjects(): Promise<Project[]> {
	return get("/api/projects");
}

export function getBlog(offset = 0, limit = 40): Promise<BlogResponse> {
	return get(`/api/blog?offset=${offset}&limit=${limit}`);
}

export function getServices(): Promise<Service[]> {
	return get("/api/services");
}

export function getServiceBySlug(slug: string): Promise<ServiceDetail> {
	return get(`/api/services/by-slug/${encodeURIComponent(slug)}`);
}

export async function postContact(data: {
	name: string;
	email: string;
	message: string;
}): Promise<{ id: number }> {
	const res = await fetch("/api/contact", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error((body as { error?: string }).error || `POST /api/contact → ${res.status}`);
	}
	return res.json();
}
