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

export interface ServiceImage {
	id: number;
	img_url: string;
	mobile_img_url: string | null;
	caption: string | null;
	sort_order: number;
}

export interface Service {
	id: number;
	name: string;
	description: string;
	link_url: string | null;
	date_created: string;
	images?: ServiceImage[];
}

export interface ServiceDetail {
	service: Service;
	projects: Project[];
}

export interface FormacionImage {
	id: number;
	img_url: string;
	mobile_img_url: string | null;
	sort_order: number;
}

export interface FormacionPage {
	intro: string;
	images: FormacionImage[];
}

export function getFormacion(): Promise<FormacionPage> {
	return get("/api/formacion");
}

// --- Fetch wrappers ---

function addLang(url: string): string {
	const sep = url.includes("?") ? "&" : "?";
	return `${url}${sep}${langParam}`;
}

async function get<T>(url: string): Promise<T> {
	const fullUrl = addLang(url);
	const res = await fetch(fullUrl);
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
	return res.json();
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
