
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Info, ChevronRight, FileText, Truck, 
  Factory, Box, Save, AlertTriangle, CheckCircle, 
  Database, Layout, Settings, LogOut, Download, PieChart
} from 'lucide-react';
import ConfirmModal from './components/ConfirmModal';
import SearchableSelect from './components/SearchableSelect';
import { 
  Contract, Product, MaterialDBItem, CalculationResult, MaterialEntry, TransportEntry 
} from './types';
import { 
  INITIAL_MATERIAL_DB, ELECTRICITY_FACTORS, TRANSPORT_FACTORS, GOOGLE_SHEET_CSV_URL 
} from './constants';

const SimplePieChart: React.FC<{ data: { name: string; value: number; color: string; percent: number }[] }> = ({ data }) => {
  let cumulativePercent = 0;
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const slices = data.map((slice, i) => {
    const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
    cumulativePercent += slice.percent;
    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
    if (slice.percent > 0.999) return <circle key={i} cx="0" cy="0" r="1" fill={slice.color} />;
    const largeArcFlag = slice.percent > 0.5 ? 1 : 0;
    const pathData = [`M 0 0`, `L ${startX} ${startY}`, `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, `L 0 0`].join(' ');
    return <path key={i} d={pathData} fill={slice.color} className="transition-all duration-300 hover:opacity-80" />;
  });

  return (
    <div className="relative w-24 h-24 sm:w-32 sm:h-32 group">
      <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full drop-shadow-sm">
        {slices}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] shadow-lg border border-slate-200">
           佔比分析
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [materialDB, setMaterialDB] = useState<MaterialDBItem[]>(INITIAL_MATERIAL_DB);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [contracts, setContracts] = useState<Contract[]>([
    { id: 1, name: '年度採購主合約', products: [] }
  ]);
  const [activeContractId, setActiveContractId] = useState<number>(1);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '確認刪除',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    const fetchSheetData = async () => {
      setIsDbLoading(true);
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

        if (parsedData.length > 0) {
            setMaterialDB(parsedData);
            setDbError(null);
        }
      } catch (error) {
        console.error("Failed to fetch Google Sheet:", error);
        setDbError("無法連線至 Google Sheet，目前正使用本機備用資料庫。");
      } finally {
        setIsDbLoading(false);
      }
    };
    fetchSheetData();
  }, []);

  useEffect(() => {
    if (contracts.length > 0 && contracts[0].products.length === 0) {
       const newId = Date.now();
       const newProduct: Product = {
         id: newId,
         name: '新採購項目 - 手機背蓋',
         year: 2024,
         hasFullData: false,
         totalOverride: 0,
         materials: [{ id: Date.now() + 1, name: '', weight: 0, factorId: '', customFactor: 0, useDb: true }],
         upstreamTransport: [],
         manufacturing: { mode: 'perUnit', electricityUsage: 0, totalOutput: 1000 },
         downstreamTransport: { weight: 0, distance: 0, vehicleId: 't1' }
       };
       setContracts(prev => {
         const updated = [...prev];
         updated[0].products = [newProduct];
         return updated;
       });
       setActiveProductId(newId);
    }
  }, []);

  const activeContract = contracts.find(c => c.id === activeContractId);
  const activeProduct = activeContract?.products.find(p => p.id === activeProductId);

  const addContract = () => {
    const newId = Date.now();
    setContracts([...contracts, { id: newId, name: '新契約草稿', products: [] }]);
    setActiveContractId(newId);
    setActiveProductId(null);
  };

  const deleteContract = (contractId: number) => {
    if (contracts.length <= 1) {
      alert("系統必須保留至少一個有效契約。");
      return;
    }
    setConfirmConfig({
      isOpen: true,
      title: '刪除契約',
      message: '您確定要刪除整個契約及其內含的所有產品項目嗎？此操作將無法復原。',
      onConfirm: () => {
        const newContracts = contracts.filter(c => c.id !== contractId);
        setContracts(newContracts);
        if (activeContractId === contractId) {
          setActiveContractId(newContracts[0].id);
          setActiveProductId(null);
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addProduct = (targetContractId: number) => {
    const newId = Date.now();
    const newProduct: Product = {
      id: newId,
      name: '新建產品項目',
      year: 2024,
      hasFullData: false,
      totalOverride: 0,
      materials: [{ id: Date.now() + 1, name: '', weight: 0, factorId: '', customFactor: 0, useDb: true }],
      upstreamTransport: [],
      manufacturing: { mode: 'perUnit', electricityUsage: 0, totalOutput: 1000 },
      downstreamTransport: { weight: 0, distance: 0, vehicleId: 't1' }
    };
    
    setContracts(prev => prev.map(c => c.id === targetContractId ? { ...c, products: [...c.products, newProduct] } : c));
    setActiveContractId(targetContractId);
    setActiveProductId(newId);
  };

  const deleteProduct = (contractId: number, productId: number) => {
    setConfirmConfig({
      isOpen: true,
      title: '刪除產品',
      message: '確定要移除此項產品的碳足跡計算資料嗎？',
      onConfirm: () => {
        setContracts(prev => prev.map(c => c.id === contractId ? { ...c, products: c.products.filter(p => p.id !== productId) } : c));
        if (activeProductId === productId) setActiveProductId(null);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const updateProduct = (key: keyof Product, value: any) => {
    setContracts(prev => prev.map(c => c.id === activeContractId ? {
      ...c, 
      products: c.products.map(p => p.id === activeProductId ? { ...p, [key]: value } : p)
    } : c));
  };

  const deleteMaterial = (materialIndex: number, materialId: number | string) => {
    setConfirmConfig({
      isOpen: true,
      title: '刪除原料',
      message: '移除此原料將同時刪除與其相關聯的運輸記錄。確定執行？',
      onConfirm: () => {
        setContracts(prev => prev.map(c => c.id === activeContractId ? {
          ...c,
          products: c.products.map(p => {
            if (p.id !== activeProductId) return p;
            return {
              ...p,
              materials: p.materials.filter((_, i) => i !== materialIndex),
              upstreamTransport: p.upstreamTransport.filter(t => t.materialId !== materialId)
            };
          })
        } : c));
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const updateNested = (section: string, index: number, field: string, value: any) => {
    if (!activeProduct) return;
    setContracts(prev => prev.map(c => {
      if (c.id !== activeContractId) return c;
      return {
        ...c,
        products: c.products.map(p => {
          if (p.id !== activeProductId) return p;
          if (section === 'materials') {
            const mats = [...p.materials];
            mats[index] = { ...mats[index], [field]: value };
            return { ...p, materials: mats };
          }
          if (section === 'upstreamTransport') {
            const trans = [...p.upstreamTransport];
            trans[index] = { ...trans[index], [field]: value };
            return { ...p, upstreamTransport: trans };
          }
          if (section === 'manufacturing') {
             return { ...p, manufacturing: { ...p.manufacturing, [field]: value } };
          }
          if (section === 'downstreamTransport') {
             return { ...p, downstreamTransport: { ...p.downstreamTransport, [field]: value } };
          }
          return p;
        })
      };
    }));
  };

  const calculation = useMemo<CalculationResult>(() => {
    if (!activeProduct) return { A: 0, B: 0, C: 0, D: 0, total: 0 };
    if (activeProduct.hasFullData) return { A: 0, B: 0, C: 0, D: 0, total: Number(activeProduct.totalOverride) };

    let A = 0;
    activeProduct.materials.forEach(m => {
      const factor = m.useDb ? (materialDB.find(db => db.id === m.factorId)?.factor || 0) : Number(m.customFactor);
      A += Number(m.weight) * factor;
    });

    let B = 0;
    activeProduct.upstreamTransport.forEach(t => {
      const vFactor = TRANSPORT_FACTORS.find(vf => vf.id === t.vehicleId)?.factor || 0;
      B += (Number(t.weight) / 1000) * Number(t.distance) * vFactor;
    });

    let C = 0;
    const eFactor = ELECTRICITY_FACTORS[activeProduct.year] || 0.495;
    const mfg = activeProduct.manufacturing;
    if (mfg.mode === 'perUnit') C = Number(mfg.electricityUsage) * eFactor;
    else C = (Number(mfg.electricityUsage) / (Number(mfg.totalOutput) || 1)) * eFactor;

    let D = 0;
    const dTrans = activeProduct.downstreamTransport;
    const dFactor = TRANSPORT_FACTORS.find(vf => vf.id === dTrans.vehicleId)?.factor || 0;
    D += (Number(dTrans.weight) / 1000) * Number(dTrans.distance) * dFactor;

    return {
      A: Number(A.toFixed(4)), B: Number(B.toFixed(4)), C: Number(C.toFixed(4)), D: Number(D.toFixed(4)), total: Number((A + B + C + D).toFixed(4))
    };
  }, [activeProduct, materialDB]);

  const chartData = useMemo(() => {
    if (calculation.total === 0) return [];
    return [
      { name: '原料', value: calculation.A, color: '#3B82F6', percent: calculation.A / calculation.total },
      { name: '原料運輸', value: calculation.B, color: '#10B981', percent: calculation.B / calculation.total },
      { name: '製造', value: calculation.C, color: '#F59E0B', percent: calculation.C / calculation.total },
      { name: '成品運輸', value: calculation.D, color: '#6366F1', percent: calculation.D / calculation.total },
    ].filter(s => s.percent > 0);
  }, [calculation]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-xl z-20">
        <div className="p-6 bg-gradient-to-br from-blue-700 to-indigo-800 text-white shadow-lg">
          <div className="flex items-center space-x-3 mb-2">
            <Layout className="w-5 h-5 text-white" />
            <h1 className="font-bold text-lg tracking-tight">中華電信</h1>
          </div>
          <p className="text-blue-100/70 text-[10px] uppercase font-semibold tracking-widest">ISO 14067 碳管理平台</p>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          {contracts.map(contract => (
            <div key={contract.id} className="group">
              <div 
                className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${activeContractId === contract.id ? 'bg-slate-100 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
                onClick={() => setActiveContractId(contract.id)}
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileText className={`w-4 h-4 flex-shrink-0 ${activeContractId === contract.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="truncate">{contract.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteContract(contract.id); }} className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-2 ml-4 pl-4 border-l border-slate-200 space-y-1">
                {contract.products.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => { setActiveContractId(contract.id); setActiveProductId(p.id); }}
                    className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-all group/item ${activeProductId === p.id ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <span className="truncate flex-1">{p.name || '(未命名產品)'}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteProduct(contract.id, p.id); }} className="p-1 opacity-0 group-item-hover/item:opacity-100 text-slate-400 hover:text-red-500 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button onClick={() => addProduct(contract.id)} className="flex items-center px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg w-full mt-2">
                  <Plus className="w-3.5 h-3.5 mr-2" /> 新增採購項目
                </button>
              </div>
            </div>
          ))}
          <button onClick={addContract} className="w-full flex items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 transition-all text-sm group">
            <Plus className="w-4 h-4 mr-2" /> 建立新契約
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {activeProduct ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <header className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center shadow-sm sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{activeProduct.name}</h2>
                <p className="text-xs text-slate-400 mt-1">碳足跡總額: {calculation.total} kgCO2e</p>
              </div>
              <SimplePieChart data={chartData} />
            </header>

            <div className="p-8 space-y-8">
              <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-5 bg-blue-50/50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center"><Box className="w-5 h-5 mr-2 text-blue-500" /> 原料取得階段</h3>
                  <span className="text-lg font-bold text-blue-600">{calculation.A} kgCO2e</span>
                </div>
                <div className="p-6 space-y-4">
                  {activeProduct.materials.map((m, idx) => (
                    <div key={m.id} className="flex gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 mb-1 block">原料名稱</label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={m.name} onChange={(e) => updateNested('materials', idx, 'name', e.target.value)} />
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-black text-slate-400 mb-1 block">重量(kg)</label>
                        <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={m.weight} onChange={(e) => updateNested('materials', idx, 'weight', e.target.value)} />
                      </div>
                      <div className="flex-[1.5]">
                        <label className="text-[10px] font-black text-slate-400 mb-1 block">碳排係數資料庫</label>
                        <SearchableSelect options={materialDB} value={m.factorId} onChange={(val) => updateNested('materials', idx, 'factorId', val)} placeholder="搜尋..." />
                      </div>
                      <button onClick={() => deleteMaterial(idx, m.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => updateProduct('materials', [...activeProduct.materials, { id: Date.now(), name: '', weight: 0, factorId: '', customFactor: 0, useDb: true }])} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-blue-500 transition-all font-bold text-xs"><Plus className="w-4 h-4 mr-2" /> 新增原料零件</button>
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
             <Layout className="w-24 h-24 mb-4 opacity-10" />
             <p className="font-bold">請從左側導覽列選擇項目</p>
          </div>
        )}
      </main>
    </div>
  );
}
