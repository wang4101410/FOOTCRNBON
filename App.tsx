
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

  // Fetch remote material DB
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

  // Initialize first product if empty
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

  // --- CRUD Functions ---

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

  const addMaterial = () => {
    if (!activeProduct) return;
    const newMat: MaterialEntry = { id: Date.now(), name: '', weight: 0, factorId: '', customFactor: 0, useDb: true };
    updateProduct('materials', [...activeProduct.materials, newMat]);
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

  // --- Calculations ---

  const transportValidation = useMemo(() => {
    if (!activeProduct) return {};
    const status: Record<string | number, { isValid: boolean; msg: string; diff: number }> = {};
    activeProduct.materials.forEach(m => {
      const weightInB = activeProduct.upstreamTransport
        .filter(t => t.materialId === m.id)
        .reduce((sum, t) => sum + Number(t.weight), 0);
      const diff = weightInB - Number(m.weight);
      status[m.id] = {
        isValid: diff >= -0.001,
        msg: diff < -0.001 ? '運輸重量低於原料重量' : 'OK',
        diff
      };
    });
    return status;
  }, [activeProduct]);

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
      A: Number(A.toFixed(4)),
      B: Number(B.toFixed(4)),
      C: Number(C.toFixed(4)),
      D: Number(D.toFixed(4)),
      total: Number((A + B + C + D).toFixed(4))
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

      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-xl z-20">
        <div className="p-6 bg-gradient-to-br from-blue-700 to-indigo-800 text-white shadow-lg">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Layout className="w-5 h-5 text-white" />
            </div>
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
                  <input 
                    className="bg-transparent focus:outline-none w-full truncate border-none pointer-events-auto"
                    value={contract.name}
                    onChange={(e) => setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, name: e.target.value } : c))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteContract(contract.id); }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                >
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
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteProduct(contract.id, p.id); }}
                        className="p-1 opacity-0 group-item-hover/item:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <ChevronRight className={`w-3 h-3 ${activeProductId === p.id ? 'text-blue-400' : 'text-slate-300'}`} />
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => addProduct(contract.id)}
                  className="flex items-center px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg w-full transition-colors mt-2"
                >
                  <Plus className="w-3.5 h-3.5 mr-2" /> 新增採購項目
                </button>
              </div>
            </div>
          ))}

          <button 
            onClick={addContract}
            className="w-full flex items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all text-sm group"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" /> 建立新契約
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button className="w-full flex items-center px-3 py-2 text-slate-500 hover:text-slate-700 text-sm">
            <Settings className="w-4 h-4 mr-3" /> 系統設定
          </button>
          <button className="w-full flex items-center px-3 py-2 text-slate-500 hover:text-red-600 text-sm">
            <LogOut className="w-4 h-4 mr-3" /> 登出帳號
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {activeProduct ? (
          <>
            {/* Header Dashboard */}
            <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-sm relative z-10">
              <div className="flex-1 min-w-0">
                <input 
                  className="text-2xl font-bold text-slate-900 border-none bg-transparent focus:ring-2 focus:ring-blue-500/20 rounded-lg px-2 -ml-2 w-full max-w-xl transition-all mb-2"
                  value={activeProduct.name}
                  onChange={(e) => updateProduct('name', e.target.value)}
                  placeholder="請輸入產品名稱"
                />
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-2">
                  <div className="flex items-center bg-slate-100 px-2 py-1 rounded-md">
                    <span className="mr-2">生產年份:</span>
                    <select 
                      className="bg-transparent focus:outline-none text-blue-600"
                      value={activeProduct.year}
                      onChange={(e) => updateProduct('year', Number(e.target.value))}
                    >
                      {Object.keys(ELECTRICITY_FACTORS).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center cursor-pointer hover:text-blue-600 transition-colors">
                    <input 
                      type="checkbox" 
                      className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={activeProduct.hasFullData}
                      onChange={(e) => updateProduct('hasFullData', e.target.checked)}
                    />
                    已有碳標籤或第三方核定數據 (略過階段性試算)
                  </label>
                </div>
              </div>

              <div className="flex items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm gap-6 min-w-[340px]">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">單位產品碳足跡</p>
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-3xl font-black text-blue-600 tabular-nums">{calculation.total}</span>
                    <span className="text-xs text-slate-500 font-medium">kgCO2e / Unit</span>
                  </div>
                </div>
                <div className="w-px h-12 bg-slate-100" />
                <SimplePieChart data={chartData} />
              </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 pb-20">
              
              {activeProduct.hasFullData ? (
                <section className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center animate-in slide-in-from-bottom-4 duration-500">
                   <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
                     <Save className="w-10 h-10" />
                   </div>
                   <h3 className="text-2xl font-bold text-slate-800 mb-2">直接輸入最終結果</h3>
                   <p className="text-slate-500 max-w-md mb-8">當供應商已具備 ISO 14067 查驗證明或環保署碳標籤時，可直接填列單位產品之排碳總額。</p>
                   <div className="flex items-center bg-slate-100 p-2 rounded-2xl">
                      <input 
                        type="number" 
                        className="bg-white border-none text-2xl font-bold p-4 w-48 rounded-xl focus:ring-4 focus:ring-blue-500/10 transition-all text-center"
                        value={activeProduct.totalOverride}
                        onChange={(e) => updateProduct('totalOverride', e.target.value)}
                      />
                      <span className="px-6 font-bold text-slate-400 tracking-wider">KG CO2E</span>
                   </div>
                </section>
              ) : (
                <>
                  {/* Section A: Materials */}
                  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
                    <div className="px-8 py-5 bg-gradient-to-r from-blue-50 to-white border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                          <Box className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">A. 原料取得階段</h3>
                          <p className="text-[10px] text-slate-400 font-medium">RAW MATERIAL ACQUISITION</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Subtotal</p>
                        <span className="text-lg font-bold text-blue-600 tabular-nums">{calculation.A} <span className="text-xs font-normal">kgCO2e</span></span>
                      </div>
                    </div>

                    <div className="p-8">
                      <div className="overflow-x-auto rounded-xl border border-slate-100 overflow-y-visible">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                              <th className="px-6 py-4 w-[25%]">零件名稱</th>
                              <th className="px-6 py-4 w-[15%]">計量 (kg/unit)</th>
                              <th className="px-6 py-4 w-[15%]">來源</th>
                              <th className="px-6 py-4">係數 (kgCO2e/kg)</th>
                              <th className="px-6 py-4 w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {activeProduct.materials.map((m, idx) => (
                              <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                  <input 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                                    placeholder="例: 主機外殼"
                                    value={m.name}
                                    onChange={(e) => updateNested('materials', idx, 'name', e.target.value)}
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input 
                                    type="number"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-right font-medium focus:border-blue-500 outline-none"
                                    value={m.weight}
                                    onChange={(e) => updateNested('materials', idx, 'weight', e.target.value)}
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                    <button 
                                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${m.useDb ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                      onClick={() => updateNested('materials', idx, 'useDb', true)}
                                    >DB</button>
                                    <button 
                                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${!m.useDb ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                      onClick={() => updateNested('materials', idx, 'useDb', false)}
                                    >自訂</button>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {m.useDb ? (
                                    <SearchableSelect 
                                      options={materialDB}
                                      value={m.factorId}
                                      onChange={(val) => updateNested('materials', idx, 'factorId', val)}
                                      placeholder="搜尋系統資料庫..."
                                    />
                                  ) : (
                                    <input 
                                      type="number"
                                      className="w-full bg-amber-50/50 border border-amber-200 rounded-xl px-4 py-2 text-sm font-medium focus:border-amber-400 outline-none"
                                      placeholder="請輸入自訂係數"
                                      value={m.customFactor}
                                      onChange={(e) => updateNested('materials', idx, 'customFactor', e.target.value)}
                                    />
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <button 
                                    onClick={() => deleteMaterial(idx, m.id)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button 
                        onClick={addMaterial}
                        className="mt-6 flex items-center px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4 mr-2" /> 新增原料零件
                      </button>
                    </div>
                  </section>

                  {/* Section B: Upstream Transport */}
                  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
                    <div className="px-8 py-5 bg-gradient-to-r from-emerald-50 to-white border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">B. 原料運輸階段</h3>
                          <p className="text-[10px] text-slate-400 font-medium">UPSTREAM LOGISTICS</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Subtotal</p>
                        <span className="text-lg font-bold text-emerald-600 tabular-nums">{calculation.B} <span className="text-xs font-normal">kgCO2e</span></span>
                      </div>
                    </div>

                    <div className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                         <div className="bg-slate-50 rounded-2xl p-6 flex flex-col justify-center">
                            <h4 className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                              <Info className="w-3.5 h-3.5 mr-2" /> 填報原則說明
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              本階段計算原料由「供應商端」運送至「製造廠端」的排碳。
                              若同一零件有多段運送（例如海運再轉陸運），請分別新增項目並確保總運輸重量大於等於原料總重。
                            </p>
                         </div>
                         <div className="bg-white border border-slate-100 rounded-2xl p-6 max-h-48 overflow-y-auto custom-scrollbar shadow-sm">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">運輸重量完整性檢核</h4>
                            <div className="space-y-3">
                              {activeProduct.materials.map(m => {
                                const st = transportValidation[m.id];
                                if(!st) return null;
                                return (
                                  <div key={m.id} className="flex items-center justify-between text-xs">
                                    <span className="truncate w-1/3 font-medium text-slate-700">{m.name || '未命名項目'}</span>
                                    <div className="flex items-center space-x-4">
                                      {st.isValid ? (
                                        <span className="flex items-center text-emerald-600 font-bold">
                                          <CheckCircle className="w-3 h-3 mr-1" /> OK
                                        </span>
                                      ) : (
                                        <span className="flex items-center text-red-500 font-bold">
                                          <AlertTriangle className="w-3 h-3 mr-1" /> {st.diff === -m.weight ? '未填寫' : '重量不足'}
                                        </span>
                                      )}
                                      <span className="text-slate-300 font-mono tracking-tighter">({st.diff.toFixed(2)}kg)</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {activeProduct.materials.length === 0 && <p className="text-center text-slate-300 italic text-xs py-4">尚無原料資料</p>}
                            </div>
                         </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                              <th className="px-6 py-4">對應零件 (來自 A)</th>
                              <th className="px-6 py-4 w-32">載重 (kg)</th>
                              <th className="px-6 py-4 w-32">距離 (km)</th>
                              <th className="px-6 py-4">交通工具類別</th>
                              <th className="px-6 py-4 w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {activeProduct.upstreamTransport.map((t, idx) => (
                              <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <select 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none"
                                    value={t.materialId}
                                    onChange={(e) => updateNested('upstreamTransport', idx, 'materialId', Number(e.target.value))}
                                  >
                                    <option value="">選擇原料零件...</option>
                                    {activeProduct.materials.map(m => (
                                      <option key={m.id} value={m.id}>{m.name || '(未命名)'}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-6 py-4">
                                  <input 
                                    type="number"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-right font-medium focus:border-emerald-500 outline-none"
                                    value={t.weight}
                                    onChange={(e) => updateNested('upstreamTransport', idx, 'weight', e.target.value)}
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input 
                                    type="number"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-right font-medium focus:border-emerald-500 outline-none"
                                    value={t.distance}
                                    onChange={(e) => updateNested('upstreamTransport', idx, 'distance', e.target.value)}
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <select 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:border-emerald-500 outline-none"
                                    value={t.vehicleId}
                                    onChange={(e) => updateNested('upstreamTransport', idx, 'vehicleId', e.target.value)}
                                  >
                                    {TRANSPORT_FACTORS.map(v => (
                                      <option key={v.id} value={v.id}>{v.name} ({v.factor})</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-6 py-4">
                                  <button 
                                    onClick={() => updateProduct('upstreamTransport', activeProduct.upstreamTransport.filter((_, i) => i !== idx))}
                                    className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button 
                        onClick={() => {
                          const mId = activeProduct.materials.length > 0 ? activeProduct.materials[0].id : '';
                          const newT: TransportEntry = { id: Date.now(), materialId: mId, weight: 0, distance: 0, vehicleId: 't1' };
                          updateProduct('upstreamTransport', [...activeProduct.upstreamTransport, newT]);
                        }}
                        className="mt-6 flex items-center px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4 mr-2" /> 新增運輸段次
                      </button>
                    </div>
                  </section>

                  {/* Section C: Manufacturing */}
                  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
                    <div className="px-8 py-5 bg-gradient-to-r from-amber-50 to-white border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                          <Factory className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">C. 產品製造階段</h3>
                          <p className="text-[10px] text-slate-400 font-medium">MANUFACTURING PROCESS</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Subtotal</p>
                        <span className="text-lg font-bold text-amber-600 tabular-nums">{calculation.C} <span className="text-xs font-normal">kgCO2e</span></span>
                      </div>
                    </div>

                    <div className="p-8">
                       <div className="flex space-x-4 mb-8">
                          <button 
                            onClick={() => updateNested('manufacturing', 0, 'mode', 'perUnit')}
                            className={`flex-1 p-6 rounded-2xl border-2 transition-all text-left ${activeProduct.manufacturing.mode === 'perUnit' ? 'border-amber-500 bg-amber-50/30' : 'border-slate-100 hover:border-slate-200'}`}
                          >
                             <div className={`w-8 h-8 rounded-full mb-4 flex items-center justify-center font-bold ${activeProduct.manufacturing.mode === 'perUnit' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>1</div>
                             <h4 className="font-bold text-slate-800 mb-1">模式 A: 直接填報</h4>
                             <p className="text-[10px] text-slate-400">已知單一產品生產所需的平均能耗</p>
                          </button>
                          <button 
                            onClick={() => updateNested('manufacturing', 0, 'mode', 'totalAllocated')}
                            className={`flex-1 p-6 rounded-2xl border-2 transition-all text-left ${activeProduct.manufacturing.mode === 'totalAllocated' ? 'border-amber-500 bg-amber-50/30' : 'border-slate-100 hover:border-slate-200'}`}
                          >
                             <div className={`w-8 h-8 rounded-full mb-4 flex items-center justify-center font-bold ${activeProduct.manufacturing.mode === 'totalAllocated' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
                             <h4 className="font-bold text-slate-800 mb-1">模式 B: 總量分攤</h4>
                             <p className="text-[10px] text-slate-400">依據生產線總能耗與總產量進行計算</p>
                          </button>
                       </div>

                       <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                          {activeProduct.manufacturing.mode === 'perUnit' ? (
                            <div className="flex flex-col md:flex-row items-center gap-6">
                               <div className="flex-1 w-full">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">單位產品生產耗電量 (kWh)</label>
                                  <input 
                                    type="number"
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-xl font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all tabular-nums"
                                    value={activeProduct.manufacturing.electricityUsage}
                                    onChange={(e) => updateNested('manufacturing', 0, 'electricityUsage', e.target.value)}
                                  />
                               </div>
                               <div className="hidden md:flex items-center text-slate-300">
                                  <ChevronRight className="w-8 h-8" />
                               </div>
                               <div className="flex-1 w-full p-6 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                  <div>
                                     <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tighter">當前電力排放係數 ({activeProduct.year})</p>
                                     <p className="text-xl font-black text-slate-700">{ELECTRICITY_FACTORS[activeProduct.year]}</p>
                                  </div>
                                  <PieChart className="w-8 h-8 text-amber-200" />
                               </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                               <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">該批次生產總能耗 (kWh)</label>
                                  <input 
                                    type="number"
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-xl font-bold focus:border-amber-500 outline-none transition-all tabular-nums"
                                    value={activeProduct.manufacturing.electricityUsage}
                                    onChange={(e) => updateNested('manufacturing', 0, 'electricityUsage', e.target.value)}
                                  />
                               </div>
                               <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">該批次總產品數量 (Units)</label>
                                  <input 
                                    type="number"
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-xl font-bold focus:border-amber-500 outline-none transition-all tabular-nums"
                                    value={activeProduct.manufacturing.totalOutput}
                                    onChange={(e) => updateNested('manufacturing', 0, 'totalOutput', e.target.value)}
                                  />
                               </div>
                            </div>
                          )}
                       </div>
                    </div>
                  </section>

                  {/* Section D: Downstream Transport */}
                  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
                    <div className="px-8 py-5 bg-gradient-to-r from-indigo-50 to-white border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                          <Download className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">D. 成品運送階段</h3>
                          <p className="text-[10px] text-slate-400 font-medium">DOWNSTREAM DISTRIBUTION</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Subtotal</p>
                        <span className="text-lg font-bold text-indigo-600 tabular-nums">{calculation.D} <span className="text-xs font-normal">kgCO2e</span></span>
                      </div>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">成品單體含包裝重量 (kg)</label>
                          <input 
                            type="number"
                            className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 text-lg font-bold focus:border-indigo-500 outline-none transition-all"
                            value={activeProduct.downstreamTransport.weight}
                            onChange={(e) => updateNested('downstreamTransport', 0, 'weight', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">運送至中華電信倉庫距離 (km)</label>
                          <input 
                            type="number"
                            className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 text-lg font-bold focus:border-indigo-500 outline-none transition-all"
                            value={activeProduct.downstreamTransport.distance}
                            onChange={(e) => updateNested('downstreamTransport', 0, 'distance', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">採行運送工具</label>
                          <select 
                            className="w-full h-[52px] bg-white border border-slate-200 rounded-2xl px-6 text-sm font-semibold focus:border-indigo-500 outline-none transition-all"
                            value={activeProduct.downstreamTransport.vehicleId}
                            onChange={(e) => updateNested('downstreamTransport', 0, 'vehicleId', e.target.value)}
                          >
                            {TRANSPORT_FACTORS.map(v => (
                               <option key={v.id} value={v.id}>{v.name} ({v.factor})</option>
                            ))}
                          </select>
                        </div>
                    </div>
                  </section>
                </>
              )}
            </div>
            
            {/* Sticky Actions Bar */}
            <div className="fixed bottom-0 right-0 left-72 bg-white/80 backdrop-blur-xl border-t border-slate-200 p-4 flex justify-between items-center z-30 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
               <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                     <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">系統已自動存檔</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 border-l border-slate-200 pl-6">
                     <Database className="w-3.5 h-3.5" />
                     <span>資料庫最後更新: 今日 10:45 AM</span>
                  </div>
               </div>
               <div className="flex items-center space-x-3">
                  <button className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center">
                    <Download className="w-4 h-4 mr-2" /> 導出 Excel
                  </button>
                  <button className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center">
                    提交審核 <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 animate-in fade-in zoom-in-95 duration-700">
             <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mb-8">
               <Layout className="w-12 h-12 text-slate-300" />
             </div>
             <h2 className="text-2xl font-bold text-slate-400 mb-4">請開始您的碳足跡試算</h2>
             <p className="text-slate-400 max-w-sm mb-8">請從左側導覽列選擇現有契約項目，或點擊「新增採購項目」開始填報產品生命週期數據。</p>
             <button 
               onClick={() => addProduct(activeContractId)}
               className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all"
             >
               立即新增採購項目
             </button>
          </div>
        )}
      </main>
    </div>
  );
}
