
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, X, ChevronDown } from 'lucide-react';
import { MaterialDBItem } from '../types';

interface SearchableSelectProps {
  options: MaterialDBItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null); 
  
  useEffect(() => {
    const selected = options.find(o => o.id === value);
    if (selected) {
      setSearchTerm(`${selected.name} (${selected.factor} ${selected.unit1}/${selected.unit2})`);
    } else if (value === '') {
      setSearchTerm('');
    }
  }, [value, options]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  useEffect(() => {
     if (isOpen && wrapperRef.current) {
         const rect = wrapperRef.current.getBoundingClientRect();
         setPosition({
             top: rect.bottom + window.scrollY, 
             left: rect.left + window.scrollX,
             width: rect.width
         });
     }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isClickInsideInput = wrapperRef.current?.contains(event.target as Node);
      const isClickInsideDropdown = dropdownRef.current?.contains(event.target as Node);

      if (!isClickInsideInput && !isClickInsideDropdown) {
        setIsOpen(false);
        const selected = options.find(o => o.id === value);
        if (selected) {
            setSearchTerm(`${selected.name} (${selected.factor} ${selected.unit1}/${selected.unit2})`);
        } else if (value === '') {
            setSearchTerm(''); 
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  const filteredOptions = options.filter(opt => {
     const label = `${opt.name} (${opt.factor} ${opt.unit1}/${opt.unit2})`;
     return label.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const portalContent = isOpen ? (
    <div 
      ref={dropdownRef} 
      className="fixed z-[9999] bg-white border border-slate-200 rounded-xl mt-1 max-h-64 overflow-y-auto shadow-2xl ring-1 ring-black ring-opacity-5 divide-y divide-slate-100"
      style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`
      }}
    >
      {filteredOptions.length > 0 ? (
        filteredOptions.map(opt => (
          <div 
            key={opt.id}
            className={`px-4 py-3 cursor-pointer transition-colors ${opt.id === value ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            onMouseDown={() => {
                onChange(opt.id);
                setIsOpen(false);
            }}
          >
            <div className={`text-sm font-semibold ${opt.id === value ? 'text-blue-700' : 'text-slate-800'}`}>
              {opt.name}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              係數: {opt.factor} {opt.unit1}/{opt.unit2}
            </div>
          </div>
        ))
      ) : (
        <div className="px-4 py-6 text-center text-slate-400 text-sm">找不到符合的原料</div>
      )}
    </div>
  ) : null;

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative group">
        <input
          type="text"
          className="w-full h-10 border border-slate-300 rounded-xl px-4 pr-10 text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5 text-slate-400">
           {searchTerm && (
               <X 
                 size={16} 
                 className="cursor-pointer hover:text-slate-600 transition-colors"
                 onClick={(e) => {
                     e.stopPropagation();
                     onChange(''); 
                     setSearchTerm('');
                     setIsOpen(true);
                 }}
               />
           )}
           <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {ReactDOM.createPortal(portalContent, document.body)}
    </div>
  );
};

export default SearchableSelect;
