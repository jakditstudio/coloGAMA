
const BASE_URL = '/api' // Use relative path for frontend proxy to backend
const BACKEND_DOWN_MESSAGE = "The camera service isn't responding right now. It may be restarting — please wait a few seconds or try to contact the developer if the issue persists";

export async function apiRequest(endpoint, options = {}) {
    let response;
    try {
        response = await fetch(`${BASE_URL}${endpoint}`, options);
    } catch (error) {
        console.error(`Error fetching API endpoint ${endpoint}:`, error);
        throw new Error(BACKEND_DOWN_MESSAGE);
    }

    if (!response.ok) {
        let detail = "Something went wrong. Please try again.";
        try {
            const data = await response.json();
            detail = data.detail || detail;
        } catch {
            
        }
        throw new Error(detail);
    }

    return response;
}

export const triggerCapture = async () => {
    const response = await apiRequest('/capture', {
        method: 'POST',
    });
   return response.json();
};


export const getHistory = async () => {
    const response = await apiRequest('/history');
    return response.json();
};

export const getFileUrl = (path) => {
    if (!path) return '';
    // If the backend already returns an absolute URL, use it as-is
    if (path.startsWith('http')) return path;
    return `${BASE_URL}${path}`;
};

