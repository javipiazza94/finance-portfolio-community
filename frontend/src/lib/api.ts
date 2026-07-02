import axios from 'axios';
import { useEffect, useState } from 'react';

// Unified API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,  // 2min — LLM analysis can take 30-60s
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * SSE Hook for real-time price updates.
 */
export function useMarketStream() {
  const [prices, setPrices] = useState<Record<string, { price: number; change_1d: number; name: string }>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE_URL}/stream/prices`);

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'price_update') {
          setPrices((prev) => ({
            ...prev,
            [data.ticker]: {
              price: data.price,
              change_1d: data.change_1d,
              name: data.name,
            },
          }));
        }
      } catch (err) {
        console.error('Failed to parse SSE data', err);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return { prices, connected };
}

// ── Market ──────────────────────────────────────────────────────────────────
export const fetchIndices = async () => (await api.get('/market/indices')).data;
export const fetchMarketBrowse = async (indexName: string) => (await api.get(`/market/browse/${indexName}`)).data;
export const fetchAssetHistory = async (ticker: string, period: string = '1y') => (await api.get(`/market/history/${ticker}?period=${period}`)).data;
export const searchAssets = async (query: string) => (await api.get(`/market/search?q=${query}`)).data;
export const searchYF = async (query: string) => (await api.get(`/market/search/yf?q=${query}`)).data;
export const addAsset = async (data: { ticker: string; name: string; asset_type: string }) => (await api.post('/market/assets', data)).data;
export const fetchCompanyAnalysis = async (ticker: string) =>
  (await api.get(`/market/${ticker}/analysis`, { timeout: 180000 })).data;

export const fetchProfileQuestions = async () => (await api.get('/portfolios/test/questions')).data;
export const submitProfileTest = async (answers: number[]) => (await api.post('/portfolios/test/submit', { answers })).data;
export const fetchLatestProfile = async () => (await api.get('/portfolios/test/profile')).data;

// ── Portfolios ──────────────────────────────────────────────────────────────
export const fetchPersonalPortfolio = async () => (await api.get('/portfolios/personal')).data;
export const buyAsset = async (data: { ticker: string; amount?: number; units?: number; price: number; date?: string; asset_name?: string }) => (await api.post('/portfolios/personal/buy', data)).data;
export const sellAsset = async (data: { ticker: string; amount?: number; units?: number; price: number; date?: string }) => (await api.post('/portfolios/personal/sell', data)).data;
export const fetchTrades = async (limit = 50, offset = 0) => (await api.get(`/portfolios/personal/trades?limit=${limit}&offset=${offset}`)).data;
export const deletePosition = async (ticker: string) => (await api.delete(`/portfolios/personal/position/${ticker}`)).data;
export const updateAvgPrice = async (ticker: string, avg_price: number) =>
  (await api.patch(`/portfolios/personal/position/${ticker}/avg-price`, { avg_price })).data;
export const updateUnits = async (ticker: string, units: number) =>
  (await api.patch(`/portfolios/personal/position/${ticker}/units`, { units })).data;
export const refreshPortfolioPrices = async () => (await api.post('/portfolios/personal/refresh-prices')).data;


// ── Model Portfolios ────────────────────────────────────────────────────────
export const fetchModelOverview = async () => (await api.get('/models/overview')).data;
export const fetchModelDetails = async (id: number) => (await api.get(`/models/${id}`)).data;
export const fetchModelNav = async (id: number, period: string = '5y') => (await api.get(`/models/${id}/nav?period=${period}`)).data;
export const replicateModel = async (id: number, amount: number) => (await api.post(`/models/${id}/replicate`, { amount })).data;


// ── Analysis & Alerts ───────────────────────────────────────────────────────
export const fetchIndicators = async (ticker: string) => (await api.get(`/analysis/indicators/${ticker}`)).data;
export const fetchAiSummary = async (ticker: string) => (await api.get(`/analysis/${ticker}/ai-summary`)).data;
export const fetchSignals = async () => (await api.get('/analysis/signals')).data;
export const fetchAlerts = async () => (await api.get('/alerts')).data;
export const fetchNews = async (ticker: string) => (await api.get(`/news/${ticker}`)).data;
export const fetchVapidKey = async () => (await api.get('/alerts/push/vapid-public-key')).data;
export const subscribePush = async (subscription: any) => (await api.post('/alerts/push/subscribe', subscription)).data;
export const refreshMarketQuotes = async () =>
  (await api.post('/market/refresh', null, { timeout: 120_000 })).data;
