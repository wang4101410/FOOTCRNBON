
export interface MaterialDBItem {
  id: string;
  name: string;
  factor: number;
  unit1: string;
  unit2: string;
}

export interface MaterialEntry {
  id: number | string;
  name: string;
  weight: number;
  factorId: string;
  customFactor: number;
  useDb: boolean;
}

export interface TransportEntry {
  id: number | string;
  materialId: number | string;
  weight: number;
  distance: number;
  vehicleId: string;
}

export interface Product {
  id: number;
  name: string;
  year: number;
  hasFullData: boolean;
  totalOverride: number;
  materials: MaterialEntry[];
  upstreamTransport: TransportEntry[];
  manufacturing: {
    mode: 'perUnit' | 'totalAllocated';
    electricityUsage: number;
    totalOutput: number;
  };
  downstreamTransport: {
    weight: number;
    distance: number;
    vehicleId: string;
  };
}

export interface Contract {
  id: number;
  name: string;
  products: Product[];
}

export interface CalculationResult {
  A: number;
  B: number;
  C: number;
  D: number;
  total: number;
}
