
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, FileText, Truck, Factory, Box, 
  Save, CheckCircle, LayoutDashboard, Settings, 
  Monitor, Database, Download 
} from 'lucide-react';
import { 
  Contract, Product, MaterialDBItem, CalculationResult 
} from './types';
import { 
  INITIAL_MATERIAL_DB, ELECTRICITY_FACTORS, TRANSPORT_FACTORS, GOOGLE_SHEET_CSV_URL 
} from './constants';
import SearchableSelect from './components/SearchableSelect';
import ConfirmModal from './components/ConfirmModal';

export default function App() {
  const [materialDB, setMaterialDB] = useState<MaterialDBItem[]>(INITIAL_MATERIAL_DB);
  const [contracts, setContracts] = useState<Contract[]>([
    { id: 1, name: '2024 年度主合約', products: [] }
  ]);
  const [activeContractId, setActiveContractId] = useState<number>(1);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);

  // 確認視窗狀態
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    const fetchSheetData = async () => {
      try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        const text = await response.text();
        const rows = text.split('\n').map(row => row.split(','));
        const parsedData = rows.slice(1).map((col, index) => {
          if (!col[1]) return null;
          const name = col[1]?.replace(/^"|"$/g, '').trim(); 
          const factor = parseFloat(col[2]?.replace(/^"|"$/g, '').trim());
          const unit1 = col[3]?.replace(/^"|"$/g, '').trim();
          const unit2 = col[5]?.replace(/^"|"$/g, '').trim();
          if (!name || isNaN(factor)) return null;
          return { id: `sheet_${index}`, name, factor, unit1, unit2 };
        }).filter(item => item !== null) as MaterialDBItem[];
        if (parsedData.length > 0) setMaterialDB(parsedData);
      } catch (e) { console.error("資料載入失敗", e); }
    };
    fetchSheetData();
  }, []);

  const activeContract = contracts.find(c => c.id === activeContractId);
  const activeProduct = activeContract?.products.find(p => p.id === activeProductId);

  const addContract = () => {
    const id = Date.now();
    setContracts([...contracts, { id, name: '新採購合約', products: [] }]);
    setActiveContractId(id);
    setActiveProductId(null);
  };

  const deleteContract = (id: number) => {
    if (contracts.length <= 1) return;
    setConfirmConfig({
      isOpen: true,
      title: '刪除採購合約',
      message: '確定要移除此合約及所有產品試算資料嗎？此操作無法還原。',
      onConfirm: () => {
        const filtered = contracts.filter(c => c.id !== id);
        setContracts(filtered);
        if (activeContractId === id) {
          setActiveContractId(filtered[0].id);
          setActiveProductId(null);
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addProduct = (cId: number) => {
    const id = Date.now();
    const newP: Product = {
      id, name: '新採購產品', year: 2024, hasFullData: false, totalOverride: 0,
      materials: [{ id: Date.now() + 1, name: '', weight: 0, factorId: '', customFactor: 0, useDb: true }],
      upstreamTransport: [],
      manufacturing: { mode: 'perUnit', electricityUsage: 0, totalOutput: 1000 },
      downstreamTransport: { weight: 0, distance: 0, vehicleId: 't1' }
    };
    setContracts(prev => prev.map(c => c.id === cId ? { ...c, products: [...c.products, newP] } : c));
    setActiveProductId(id);
  };

  const deleteProduct = (cId: number, pId: number) => {
    setConfirmConfig({
      isOpen: true,
      title: '刪除產品項目',
      message: '確定要移除此產品的碳足跡數據嗎？',
      onConfirm: () => {
        setContracts(prev => prev.map(c => c.id === cId ? { ...c, products: c.products.filter(p => p.id !== pId) } : c));
        if (activeProductId === pId) setActiveProductId(null);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const deleteMaterial = (idx: number, mId: number | string) => {
    setConfirmConfig({
      isOpen: true,
      title: '刪除原料',
      message: '確定要移除此原料嗎？關聯的運輸數據也會一併清除。',
      onConfirm: () => {
        setContracts(prev => prev.map(c => c.id === activeContractId ? {
          ...c, products: c.products.map(p => p.id === activeProductId ? {
            ...p, 
            materials: p.materials.filter((_, i) => i !== idx),
            upstreamTransport: p.upstreamTransport.filter(t => t.materialId !== mId)
          } : p)
        } : c));
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const calculation = useMemo<CalculationResult>(() => {
    if (!activeProduct) return { A: 0, B: 0, C: 0, D: 0, total: 0 };
    let A = 0;
    activeProduct.materials.forEach(m => {
      const f = materialDB.find(db => db.id === m.factorId)?.factor || 0;
      A += Number(m.weight) * f;
    });
    let B = 0;
    activeProduct.upstreamTransport.forEach(t => {
      const f = TRANSPORT_FACTORS.find(vf => vf.id === t.vehicleId)?.factor || 0;
      B += (Number(t.weight) / 1000) * Number(t.distance) * f;
    });
    const ef = ELECTRICITY_FACTORS[activeProduct.year] || 0.495;
    const mfg = activeProduct.manufacturing;
    let C = (mfg.mode === 'perUnit' ? Number(mfg.electricityUsage) : (Number(mfg.electricityUsage) / (Number(mfg.totalOutput) || 1))) * ef;
    const dt = activeProduct.downstreamTransport;
    const df = TRANSPORT_FACTORS.find(vf => vf.id === dt.vehicleId)?.factor || 0;
    let D = (Number(dt.weight) / 1000) * Number(dt.distance) * df;
    const total = A + B + C + D;
    return { A, B, C, D, total: Number(total.toFixed(4)) };
  }, [activeProduct, materialDB]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <aside className="w-72 bg-slate-900 flex flex-col shadow-2xl z-20 text-white">
        <div className="p-6 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center space-x-3 mb-2">
            <LayoutDashboard className="w-6 h-6 text-blue-400" />
            <h1 className="font-bold text-lg">碳管理平台</h1>
          </div>
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">ISO 14067 Management</p>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {contracts.map(contract => (
            <div key={contract.id} className="space-y-1">
              <div 
                className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer group ${activeContractId === contract.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                onClick={() => setActiveContractId(contract.id)}
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileText className="w-4 h-4" />
                  <span className="truncate text-sm font-medium">{contract.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteContract(contract.id); }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="ml-6 space-y-1 border-l border-slate-700 pl-4 mt-1">
                {contract.products.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => { setActiveContractId(contract.id); setActiveProductId(p.id); }} 
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer group/item ${activeProductId === p.id ? 'bg-blue-500/10 text-blue-400 font-bold border-l-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <span className="truncate">{p.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteProduct(contract.id, p.id); }} className="opacity-0 group-item-hover/item:opacity-100 text-slate-600 hover:text-red-400 p-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button onClick={() => addProduct(contract.id)} className="flex items-center px-3 py-1.5 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest">
                  <Plus className="w-3 h-3 mr-2" /> 新增產品
                </button>
              </div>
            </div>
          ))}
          <button onClick={addContract} className="w-full flex items-center justify-center p-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-400 transition-all font-bold text-xs">
            <Plus className="w-4 h-4 mr-2" /> 建立新契約
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {activeProduct ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <header className="bg-white border-b px-8 py-6 flex justify-between items-center sticky top-0 z-10 shadow-sm">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{activeProduct.name}</h2>
                <div className="text-xs text-slate-400 mt-1 font-bold">目前總計: {calculation.total} kgCO2e / Unit</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl text-blue-700 font-bold text-sm">
                  單位排放量: {calculation.total}
                </div>
              </div>
            </header>

            <div className="p-8 space-y-6">
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b bg-slate-50/50 flex justify-between items-center rounded-t-2xl">
                  <h3 className="font-bold text-slate-700 flex items-center"><Box className="w-5 h-5 mr-2 text-blue-500" /> 原料階段</h3>
                  <span className="text-xs font-bold text-slate-400">總計: {calculation.A} kgCO2e</span>
                </div>
                <div className="p-6 space-y-4">
                  {activeProduct.materials.map((m, idx) => (
                    <div key={m.id} className="flex gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase">名稱</label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={m.name} onChange={() => {}} />
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase">重量(kg)</label>
                        <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={m.weight} onChange={() => {}} />
                      </div>
                      <div className="flex-[1.5]">
                        <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase">碳排係數資料庫</label>
                        <SearchableSelect options={materialDB} value={m.factorId} onChange={() => {}} placeholder="搜尋..." />
                      </div>
                      <button onClick={() => deleteMaterial(idx, m.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50">
            <Monitor className="w-16 h-16 mb-4" />
            <p className="font-bold">請由左側選單選擇產品或合約</p>
          </div>
        )}
      </main>
    </div>
  );
}
