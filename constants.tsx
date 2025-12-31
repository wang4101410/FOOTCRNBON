
export const ELECTRICITY_FACTORS: Record<number, number> = {
  2023: 0.495,
  2024: 0.494,
  2025: 0.474,
  2026: 0.455,
};

export const TRANSPORT_FACTORS = [
  { id: 't1', name: '大貨車 (柴油)', factor: 0.131, unit: 'kgCO2e/t-km' },
  { id: 't2', name: '小貨車 (柴油)', factor: 0.587, unit: 'kgCO2e/t-km' },
  { id: 't3', name: '小貨車 (汽油)', factor: 0.683, unit: 'kgCO2e/t-km' },
  { id: 't4', name: '國際海運貨物運輸服務', factor: 1.98, unit: 'kgCO2e/t-km' },
  { id: 't5', name: '國際航運', factor: 1.16, unit: 'kgCO2e/t-km' },
];

export const INITIAL_MATERIAL_DB = [
  { id: 'm1', name: '鋁合金 (Aluminum)', factor: 6.7, unit1: 'kgCO2e', unit2: 'kg' },
  { id: 'm2', name: '不鏽鋼 (Stainless Steel)', factor: 6.1, unit1: 'kgCO2e', unit2: 'kg' },
  { id: 'm3', name: '銅 (Copper)', factor: 3.8, unit1: 'kgCO2e', unit2: 'kg' },
];

export const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1KicP3sEwRexAy8M3A2xRcQIMbwcB_cmlYEsRWKK_FTw/export?format=csv';
