'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddressResult {
  address: string;
  postalCode: string;
  city: string;
  lat: number;
  lon: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, postalCode: string, city: string, lat: number, lon: number) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}

const GEONORGE_API = 'https://ws.geonorge.no/adresser/v1/sok';

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  label,
  error,
  placeholder = 'Søk etter adresse...',
}: AddressAutocompleteProps) {
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        sok: query,
        treffPerSide: '5',
        utkoordsys: '4258',
      });
      const res = await fetch(`${GEONORGE_API}?${params}`, { signal: controller.signal });
      if (!res.ok) {
        setResults([]);
        return;
      }
      const data = await res.json();
      const mapped: AddressResult[] = (data.adresser || []).map((a: any) => ({
        address: a.adressetekst,
        postalCode: a.postnummer,
        city: a.poststed,
        lat: a.representasjonspunkt.lat,
        lon: a.representasjonspunkt.lon,
      }));
      setResults(mapped);
      setIsOpen(mapped.length > 0);
      setActiveIndex(-1);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setResults([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const selectResult = (result: AddressResult) => {
    onChange(result.address);
    onSelect(result.address, result.postalCode, result.city, result.lat, result.lon);
    setIsOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectResult(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            'input-field pl-9',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-500'
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((result, index) => (
            <li
              key={`${result.lat}-${result.lon}`}
              onClick={() => selectResult(result)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                'px-3 py-2.5 cursor-pointer text-sm transition-colors',
                index === activeIndex ? 'bg-gray-50' : 'hover:bg-gray-50'
              )}
            >
              <p className="font-medium text-gray-900">{result.address}</p>
              <p className="text-xs text-gray-500">
                {result.postalCode} {result.city}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
