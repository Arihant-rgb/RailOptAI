import axios from 'axios';

// Base API configuration (uses relative path for Vite proxy or direct base URL)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Health check
export const checkHealth = async () => {
  try {
    const response = await api.get('/');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// KPIs API
export const getKPIs = async () => {
  const response = await api.get('/api/kpis');
  return response.data;
};

// Maintenance Jobs API
export const getMaintenanceJobs = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.department && filters.department !== 'All') params.append('department', filters.department);
  if (filters.section && filters.section !== 'All') params.append('section', filters.section);
  if (filters.priority && filters.priority !== 'All') params.append('priority', filters.priority);
  if (filters.status && filters.status !== 'All') params.append('status', filters.status);

  const response = await api.get(`/api/maintenance?${params.toString()}`);
  return response.data;
};

export const getMaintenanceJobById = async (id) => {
  const response = await api.get(`/api/maintenance/${id}`);
  return response.data;
};

export const createMaintenanceJob = async (jobData) => {
  const response = await api.post('/api/maintenance', jobData);
  return response.data;
};

// Railway Network APIs
export const getStations = async () => {
  const response = await api.get('/api/network/stations');
  return response.data;
};

export const getSections = async () => {
  const response = await api.get('/api/network/sections');
  return response.data;
};

// Trains & Movements APIs
export const getTrains = async () => {
  const response = await api.get('/api/trains');
  return response.data;
};

export const getTrainMovements = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.date) params.append('date', filters.date);
  if (filters.section && filters.section !== 'All') params.append('section', filters.section);

  const response = await api.get(`/api/trains/movements?${params.toString()}`);
  return response.data;
};

// Candidate Blocks API
export const getBlocks = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.section && filters.section !== 'All') params.append('section', filters.section);
  if (filters.date) params.append('date', filters.date);
  if (filters.status && filters.status !== 'All') params.append('status', filters.status);

  const response = await api.get(`/api/blocks?${params.toString()}`);
  return response.data;
};

export const assignBlock = async (payload) => {
  const response = await api.post('/api/blocks/assign', payload);
  return response.data;
};

export const updateBlockStatus = async (blockId, status) => {
  const response = await api.patch(`/api/blocks/${blockId}/status`, { status });
  return response.data;
};

// Planning & Optimization APIs
export const generatePlan = async (payload = {}) => {
  const response = await api.post('/api/planning/generate', payload);
  return response.data;
};

export const resetDemo = async () => {
  const response = await api.post('/api/planning/reset-demo');
  return response.data;
};

export const getWeeklyPlan = async () => {
  const response = await api.get('/api/planning/weekly');
  return response.data;
};

export const getMonthlyPlan = async () => {
  const response = await api.get('/api/planning/monthly');
  return response.data;
};

export const forwardPlanning = async (payload) => {
  const response = await api.post('/api/planning/forward', payload);
  return response.data;
};

export const reversePlanning = async (payload) => {
  const response = await api.post('/api/planning/reverse', payload);
  return response.data;
};

export const triggerReplanning = async (payload) => {
  const response = await api.post('/api/planning/replan', payload);
  return response.data;
};

export default api;
