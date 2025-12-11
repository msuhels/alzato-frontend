import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';

type ColumnFilterMenuProps = {
  label: string;
  options: string[];
  selectedValues: string[];
  onApply: (values: string[]) => void;
  onSort: (dir: 'asc' | 'desc') => void;
  sortDir?: 'asc' | 'desc' | null;
  enableOptions?: boolean; // when false, show only sorting (no checkboxes/search)
  isDate?: boolean; // when true, show a date picker input
  rangeType?: 'date' | 'number'; // when set, render from/to range inputs
};

// Minimal Excel-like column filter dropdown with search, select-all, and sort buttons.
const ColumnFilterMenu = ({
  label,
  options,
  selectedValues,
  onApply,
  onSort,
  sortDir = null,
  enableOptions = true,
  isDate = false,
  rangeType,
}: ColumnFilterMenuProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [localSelection, setLocalSelection] = useState<string[]>(selectedValues);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  useEffect(() => {
    setLocalSelection(selectedValues);
    if (rangeType) {
      const fromVal = selectedValues.find((v) => v.startsWith('min:') || v.startsWith('from:') || v.startsWith('gte:'));
      const toVal = selectedValues.find((v) => v.startsWith('max:') || v.startsWith('to:') || v.startsWith('lte:'));
      setRangeFrom(fromVal ? fromVal.split(':')[1] || '' : '');
      setRangeTo(toVal ? toVal.split(':')[1] || '' : '');
    }
    if (!enableOptions) {
      setSearch(selectedValues?.[0] || '');
    }
  }, [selectedValues, open, enableOptions, rangeType]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener('click', handler);
    }
    return () => window.removeEventListener('click', handler);
  }, [open]);

  const updateMenuPosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 320;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
    const top = rect.bottom + 6;
    setMenuPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onResize = () => updateMenuPosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, search]);

  const allSelected = filteredOptions.length > 0 && filteredOptions.every(opt => localSelection.includes(opt));

  const isCheckboxMode = enableOptions;

  const toggleOption = (opt: string) => {
    setLocalSelection(prev => prev.includes(opt) ? prev.filter(v => v !== opt) : [...prev, opt]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setLocalSelection(prev => Array.from(new Set([...prev, ...filteredOptions])));
    } else {
      setLocalSelection(prev => prev.filter(v => !filteredOptions.includes(v)));
    }
  };

  const applyFilters = () => {
    if (rangeType === 'date') {
      const payload: string[] = [];
      if (rangeFrom) payload.push(`from:${rangeFrom}`);
      if (rangeTo) payload.push(`to:${rangeTo}`);
      onApply(payload);
    } else if (rangeType === 'number') {
      const payload: string[] = [];
      if (rangeFrom) payload.push(`min:${rangeFrom}`);
      if (rangeTo) payload.push(`max:${rangeTo}`);
      onApply(payload);
    } else if (isCheckboxMode) {
      onApply(localSelection);
    } else {
      const trimmed = search.trim();
      onApply(trimmed ? [trimmed] : []);
    }
    setOpen(false);
  };

  const clearFilters = () => {
    setLocalSelection([]);
    onApply([]);
    setSearch('');
    setRangeFrom('');
    setRangeTo('');
    setOpen(false);
  };

  const active = selectedValues.length > 0;

  return (
    <div className="relative inline-flex items-center gap-2" ref={containerRef}>
      <button
        type="button"
        ref={buttonRef}
        className={`flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-gray-custom-100 ${active ? 'bg-primary/10 text-primary' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
      >
        <span className="text-sm font-semibold">{label}</span>
        <ChevronDown size={14} className="text-gray-custom-400" />
      </button>
      {open && menuPos && (
        <div
          className="fixed z-40 mt-2 w-72 rounded-lg border border-gray-custom-200 bg-white shadow-xl"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <div className="p-2 space-y-1">
            <button
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-gray-custom-50"
              onClick={(e) => { e.stopPropagation(); onSort('asc'); setOpen(false); }}
            >
              <span>Sort A to Z</span>
              <span className={`text-xs ${sortDir === 'asc' ? 'text-primary font-semibold' : 'text-gray-custom-400'}`}>A→Z</span>
            </button>
            <button
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-gray-custom-50"
              onClick={(e) => { e.stopPropagation(); onSort('desc'); setOpen(false); }}
            >
              <span>Sort Z to A</span>
              <span className={`text-xs ${sortDir === 'desc' ? 'text-primary font-semibold' : 'text-gray-custom-400'}`}>Z→A</span>
            </button>
          </div>
          {(isCheckboxMode || !enableOptions) && (
            <>
              <div className="border-t border-gray-custom-200" />
              <div className="p-3">
                {rangeType ? (
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-gray-custom-500 mb-1">From</label>
                      <input
                        type={rangeType === 'date' ? 'date' : 'number'}
                        value={rangeFrom}
                        onChange={(e) => setRangeFrom(e.target.value)}
                        className="w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder={rangeType === 'date' ? 'YYYY-MM-DD' : 'Min'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-custom-500 mb-1">To</label>
                      <input
                        type={rangeType === 'date' ? 'date' : 'number'}
                        value={rangeTo}
                        onChange={(e) => setRangeTo(e.target.value)}
                        className="w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder={rangeType === 'date' ? 'YYYY-MM-DD' : 'Max'}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative mb-3">
                    {isDate ? (
                      <input
                        type="date"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        placeholder="Select date"
                      />
                    ) : (
                      <>
                        <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-custom-400" />
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full rounded-md border px-8 py-2 text-sm focus:border-primary focus:outline-none"
                          placeholder={isCheckboxMode ? "Search" : "Type value"}
                        />
                      </>
                    )}
                  </div>
                )}
                {!rangeType && (
                  isCheckboxMode ? (
                    <div className="max-h-48 overflow-y-auto pr-1 space-y-1">
                      <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-custom-50">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                        <span>Select All</span>
                      </label>
                      {filteredOptions.map(opt => (
                        <label key={opt} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-custom-50">
                          <input
                            type="checkbox"
                            checked={localSelection.includes(opt)}
                            onChange={() => toggleOption(opt)}
                          />
                          <span className="truncate">{opt}</span>
                        </label>
                      ))}
                      {filteredOptions.length === 0 && (
                        <p className="px-2 py-1 text-xs text-gray-custom-400">No values</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-custom-500 px-1">Type a value and click Apply to filter this column.</p>
                  )
                )}
              </div>
              <div className="border-t border-gray-custom-200" />
              <div className="flex justify-end gap-2 p-3">
                <button
                  className="rounded-md border px-3 py-1.5 text-sm text-gray-custom-600 hover:bg-gray-custom-50"
                  onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                >
                  Clear
                </button>
                <button
                  className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark"
                  onClick={(e) => { e.stopPropagation(); applyFilters(); }}
                >
                  Apply
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ColumnFilterMenu;

