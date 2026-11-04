import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search…', children }) {
  return (
    <div className="search-row">
      <label className="search">
        <Search size={18} className="search-icon" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </label>
      {children}
    </div>
  );
}
