import { useState, useEffect, useRef, useCallback } from 'react'
import { IoLocation, IoSearch } from 'react-icons/io5'

interface LocationSuggestion {
  place_id: string
  display_name: string
  lat: string
  lon: string
}

interface LocationAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (lat: number, lng: number, address: string) => void
  placeholder?: string
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter area or address"
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch suggestions from Nominatim (OpenStreetMap)
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([])
      return
    }
    
    setLoading(true)
    try {
      // Focus on Pakistan primarily
      const viewbox = "60.0,37.0,77.0,24.0" // Pakistan bounding box
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=${viewbox}&bounded=1&limit=5&countrycodes=pk`
      
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' }
      })
      
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data: LocationSuggestion[] = await response.json()
      setSuggestions(data)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value)
    }, 300)
    
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, fetchSuggestions])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setShowDropdown(true)
    setActiveIndex(-1)
  }

  const handleSelect = (suggestion: LocationSuggestion) => {
    const lat = parseFloat(suggestion.lat)
    const lng = parseFloat(suggestion.lon)
    const shortened = suggestion.display_name.split(',').slice(0, 4).join(',').trim()
    
    onChange(shortened)
    onSelect(lat, lng, shortened)
    setShowDropdown(false)
    setSuggestions([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelect(suggestions[activeIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        break
    }
  }

  const formatSuggestion = (displayName: string) => {
    const parts = displayName.split(',').map(p => p.trim())
    // Show first 2-3 parts for cleaner display
    if (parts.length > 3) {
      return `${parts[0]}, ${parts[1]}, ${parts[2]}...`
    }
    return displayName
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <IoLocation
          size={17}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => value.trim().length >= 2 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          className="!pl-10"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && value && (
          <IoSearch
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-border overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              onClick={() => handleSelect(suggestion)}
              className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-start gap-2 ${
                index === activeIndex ? 'bg-primary/10' : 'hover:bg-gray-50'
              }`}
            >
              <IoLocation size={16} className="text-primary mt-0.5 shrink-0" />
              <span className="text-text-primary line-clamp-2">
                {formatSuggestion(suggestion.display_name)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showDropdown && !loading && value.trim().length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-border p-4 text-center">
          <p className="text-sm text-text-muted">No locations found</p>
          <p className="text-xs text-text-muted mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  )
}
