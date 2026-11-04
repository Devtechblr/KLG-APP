// Mock mode is ON only when explicitly enabled via VITE_USE_MOCK_DATA=true.
export const USE_MOCK_DATA = String(import.meta.env.VITE_USE_MOCK_DATA).toLowerCase() === 'true';

// Shared KLG backend (Express on Cloud Functions, MongoDB behind it).
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://us-central1-krishna-leela-grand.cloudfunctions.net/api').replace(/\/+$/, '');

// How often the app re-reads orders while it is open (ms).
export const POLL_MS = Number(import.meta.env.VITE_POLL_MS) || 15000;

// Backend roles allowed into the admin side of this delivery app.
export const ADMIN_ROLES = ['Super Admin', 'Admin', 'Delivery'];
