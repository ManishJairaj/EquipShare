import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import EquipmentCard from '../components/EquipmentCard.jsx'
import api from '../services/api'
import { formatApiError } from '../utils/errorFormatter'

const formatPrice = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value))

const DEFAULT_CATEGORIES = ['Cameras', 'Electronics', 'Lab', 'Sports', 'Tools', 'Calculators']

const formatLocalDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Home() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const catalogRef = useRef(null)

  const [equipment, setEquipment] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Pagination state (backend response metadata)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  })

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchParam, setSearchParam] = useState('')

  const [selectedCategory, setSelectedCategory] = useState('All')
  const [categories, setCategories] = useState(['All'])

  const [listingMode, setListingMode] = useState('all') // 'all', 'rent', 'sell'
  const [condition, setCondition] = useState('all') // 'all', 'new', 'excellent', 'good', 'fair'
  const [availabilityStatus, setAvailabilityStatus] = useState('available')

  const [minPrice, setMinPrice] = useState('')
  const [debouncedMinPrice, setDebouncedMinPrice] = useState('')

  const [maxPrice, setMaxPrice] = useState('')
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState('')

  const [sortBy, setSortBy] = useState('newest') // 'newest', 'oldest', 'price_asc', 'price_desc'
  const [page, setPage] = useState(1)

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Booking modal states
  const [bookingItem, setBookingItem] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)

  // Fetch all unique categories once on mount
  useEffect(() => {
    const fetchAllCategories = async () => {
      try {
        const res = await api.get('/equipment', { params: { limit: 100 } })
        const responseData = res.data
        const items = responseData.items || []
        const dbCategories = [...new Set(items.map(item => item.category).filter(Boolean))]
        const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...dbCategories])).sort()
        setCategories(['All', ...combined])
      } catch (err) {
        console.error('Failed to discover categories:', err)
        setCategories(['All', ...DEFAULT_CATEGORIES])
      }
    }
    fetchAllCategories()
  }, [])

  // Fetch current user details if token exists
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) return
      try {
        const res = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setCurrentUser(res.data)
      } catch (err) {
        console.error(err)
      }
    }
    fetchUser()
  }, [token])

  // Debouncing minPrice (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMinPrice(minPrice)
    }, 300)
    return () => clearTimeout(handler)
  }, [minPrice])

  // Debouncing maxPrice (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMaxPrice(maxPrice)
    }, 300)
    return () => clearTimeout(handler)
  }, [maxPrice])

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setPage(1)
  }, [
    searchParam,
    selectedCategory,
    listingMode,
    condition,
    availabilityStatus,
    debouncedMinPrice,
    debouncedMaxPrice,
    sortBy,
  ])

  // Auto-scroll to catalog results when search query is entered
  useEffect(() => {
    if (searchParam.trim() && catalogRef.current) {
      catalogRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [searchParam])

  // Main fetch hook using server-side queries
  useEffect(() => {
    const fetchEquipment = async () => {
      setLoading(true)
      setError('')
      try {
        const params = {
          page,
          limit: 12,
          sort: sortBy,
        }

        if (searchParam.trim()) {
          params.search = searchParam.trim()
        }
        if (selectedCategory !== 'All') {
          params.category = selectedCategory
        }
        if (listingMode !== 'all') {
          params.listing_mode = listingMode
        }
        if (condition !== 'all') {
          params.condition = condition
        }
        params.availability_status = 'available'
        
        const min = parseFloat(debouncedMinPrice)
        if (debouncedMinPrice.trim() && !isNaN(min) && min >= 0) {
          params.min_price = min
        }

        const max = parseFloat(debouncedMaxPrice)
        if (debouncedMaxPrice.trim() && !isNaN(max) && max >= 0) {
          params.max_price = max
        }

        const res = await api.get('/equipment', { params })
        const responseData = res.data
        const items = responseData.items || []

        setEquipment(items)
        setPagination({
          page: Number(responseData.page ?? 1),
          limit: Number(responseData.limit ?? 12),
          total: Number(responseData.total ?? items.length),
          totalPages: Number(responseData.total_pages ?? 1),
        })
      } catch (err) {
        setEquipment([])
        setPagination({ page: 1, limit: 12, total: 0, totalPages: 1 })
        setError('Failed to fetch equipment listings.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchEquipment()
  }, [
    page,
    searchParam,
    selectedCategory,
    listingMode,
    condition,
    availabilityStatus,
    debouncedMinPrice,
    debouncedMaxPrice,
    sortBy,
  ])

  // Real-time reservation date checker
  useEffect(() => {
    if (!bookingItem || bookingItem.listing_mode !== 'rent' || !startDate || !endDate) {
      setBookingError('')
      return
    }

    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')

    if (start > end) {
      setBookingError('End date must be on or after start date.')
      return
    }

    // Check if start or end date itself is reserved
    const startReserved = bookingItem.rental_requests?.some(r => {
      if (r.status !== 'accepted') return false
      const rStart = new Date(r.start_date + 'T00:00:00')
      const rEnd = new Date(r.end_date + 'T00:00:00')
      return start >= rStart && start <= rEnd
    })

    const endReserved = bookingItem.rental_requests?.some(r => {
      if (r.status !== 'accepted') return false
      const rStart = new Date(r.start_date + 'T00:00:00')
      const rEnd = new Date(r.end_date + 'T00:00:00')
      return end >= rStart && end <= rEnd
    })

    if (startReserved) {
      setBookingError('The selected start date is already reserved. Please select a free date.')
      return
    }

    if (endReserved) {
      setBookingError('The selected end date is already reserved. Please select a free date.')
      return
    }

    // Check if selected range spans over any accepted reservation
    const hasOverlap = bookingItem.rental_requests?.some(r => {
      if (r.status !== 'accepted') return false
      const rStart = new Date(r.start_date + 'T00:00:00')
      const rEnd = new Date(r.end_date + 'T00:00:00')
      return start <= rEnd && end >= rStart
    })

    if (hasOverlap) {
      setBookingError('Selected range overlaps with an existing accepted reservation. Please check other dates.')
      return
    }

    setBookingError('')
  }, [startDate, endDate, bookingItem])

  const handleClearFilters = () => {
    setSearchQuery('')
    setSearchParam('')
    setSelectedCategory('All')
    setListingMode('all')
    setCondition('all')
    setAvailabilityStatus('available')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('newest')
    setPage(1)
  }

  const hasActiveFilters = 
    searchParam !== '' ||
    selectedCategory !== 'All' ||
    listingMode !== 'all' ||
    condition !== 'all' ||
    availabilityStatus !== 'available' ||
    minPrice !== '' ||
    maxPrice !== '' ||
    sortBy !== 'newest'

  // Handle navigating to equipment details page to book the item
  const handleRentClick = (item) => {
    navigate(`/equipment/${item.id}`)
  }

  // Calculate rental cost
  const calculateDays = () => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = end - start
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // inclusive of both dates
    return diffDays > 0 ? diffDays : 0
  }

  const handleBookingSubmit = async (e) => {
    e.preventDefault()
    
    const isRental = bookingItem.listing_mode === 'rent'
    let startVal = startDate
    let endVal = endDate

    if (isRental) {
      if (!startDate || !endDate) {
        setBookingError('Please select both start and end dates.')
        return
      }

      const days = calculateDays()
      if (days <= 0) {
        setBookingError('End date must be on or after start date.')
        return
      }

      // Check for overlap with accepted bookings
      const hasOverlap = bookingItem.rental_requests?.some(r => {
        if (r.status !== 'accepted') return false
        const rStart = new Date(r.start_date + 'T00:00:00')
        const rEnd = new Date(r.end_date + 'T00:00:00')
        const selStart = new Date(startDate + 'T00:00:00')
        const selEnd = new Date(endDate + 'T00:00:00')
        return selStart <= rEnd && selEnd >= rStart
      })

      if (hasOverlap) {
        setBookingError('These dates overlap with an existing accepted reservation. Please check "Booked Dates" and select other dates.')
        return
      }
    } else {
      // For selling items, use today's date for start & end
      const todayStr = formatLocalDate(new Date())
      startVal = todayStr
      endVal = todayStr
    }

    setBookingSubmitting(true)
    setBookingError('')
    setBookingSuccess(false)

    try {
      await api.post('/rentals', {
        equipment_id: bookingItem.id,
        start_date: startVal,
        end_date: endVal
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setBookingSuccess(true)
      setTimeout(() => {
        setBookingItem(null)
        setBookingSuccess(false)
        navigate('/dashboard')
      }, 1500)
    } catch (err) {
      setBookingError(formatApiError(err))
    } finally {
      setBookingSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 py-20 px-4 text-center text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.1),transparent)] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(168,85,247,0.08),transparent)] pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            Campus Sharing Platform
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Borrow what you need, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-400 bg-clip-text text-transparent">
              lend what you don't.
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Access sports gear, lab tools, DSLR cameras, electronics, and calculators listed by your fellow college students.
          </p>

          {/* Search bar inside hero */}
          <div className="mt-10 max-w-xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSearchParam(searchQuery)
              }}
              className="relative flex items-center bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-xl border border-slate-200/55 dark:border-slate-700/50"
            >
              <div className="pl-3 pr-2 text-slate-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cameras, calculators, lab gear..."
                className="w-full py-2.5 px-2 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none text-sm font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setSearchParam('')
                  }}
                  className="pr-3 text-slate-450 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/10"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <main ref={catalogRef} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-950 dark:text-white">Available Equipment</h2>
            <p className="text-sm text-slate-500 mt-1">
              Browse and filter {pagination.total} campus listings
            </p>
          </div>
          
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === category
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Action & Filter controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* Listing Mode Switcher */}
          <div className="flex items-center bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
            {[
              { id: 'all', label: 'All Listings' },
              { id: 'rent', label: 'For Rent' },
              { id: 'sell', label: 'For Sale' }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setListingMode(mode.id)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  listingMode === mode.id
                    ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 hidden sm:inline uppercase tracking-wider">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2.5 text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>

            {/* Advanced Filters Toggle Button */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                showAdvancedFilters
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Filters
              {/* Filter count badge */}
              {(condition !== 'all' || minPrice !== '' || maxPrice !== '') && (
                <span className={`h-2 w-2 rounded-full ${showAdvancedFilters ? 'bg-white' : 'bg-indigo-600'} animate-pulse`}></span>
              )}
            </button>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer shadow-sm border border-rose-100 dark:border-rose-900/30"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 mb-8 border border-slate-200/60 dark:border-slate-800/60 shadow-md animate-slide-down grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Condition Filter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Condition</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Any' },
                  { id: 'new', label: 'New' },
                  { id: 'excellent', label: 'Excellent' },
                  { id: 'good', label: 'Good' },
                  { id: 'fair', label: 'Fair' }
                ].map((cond) => (
                  <button
                    key={cond.id}
                    onClick={() => setCondition(cond.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      condition === cond.id
                        ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800'
                    }`}
                  >
                    {cond.label}
                  </button>
                ))}
              </div>
            </div>



            {/* Price Range Filter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Price Range (₹)</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold"
                  />
                </div>
                <span className="text-slate-400 font-bold text-xs">to</span>
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content States */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <svg className="animate-spin h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-slate-500 font-bold">Loading equipment...</span>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-center font-semibold">
            {error}
          </div>
        ) : equipment.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/55 dark:border-slate-700/30 shadow-sm">
            <svg className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Equipment Found</h3>
            <p className="text-slate-500 mt-1 max-w-sm mx-auto text-sm">
              We couldn't find any matches. Try adjusting your search query or category filters.
            </p>
          </div>
        ) : (
          <>
            {/* Equipment Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {equipment.map((item) => (
                <EquipmentCard 
                  key={item.id} 
                  item={item} 
                  isOwner={currentUser && item.owner_id === currentUser.id}
                  onRentClick={() => handleRentClick(item)}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="mt-12 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-6">
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-500 font-semibold">
                      Showing <span className="font-extrabold text-slate-900 dark:text-white">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span> of{' '}
                      <span className="font-extrabold text-slate-900 dark:text-white">{pagination.total}</span> listings
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px" aria-label="Pagination">
                      {/* Previous Button */}
                      <button
                        onClick={() => setPage(p => Math.max(p - 1, 1))}
                        disabled={pagination.page === 1}
                        className={`relative inline-flex items-center px-3.5 py-2.5 rounded-l-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      {/* Page Numbers */}
                      {Array.from({ length: pagination.totalPages }, (_, index) => {
                        const pageNum = index + 1
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2.5 border text-xs font-extrabold cursor-pointer transition-all ${
                              pagination.page === pageNum
                                ? 'z-10 bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}

                      {/* Next Button */}
                      <button
                        onClick={() => setPage(p => Math.min(p + 1, pagination.totalPages))}
                        disabled={pagination.page === pagination.totalPages}
                        className={`relative inline-flex items-center px-3.5 py-2.5 rounded-r-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Mobile pagination controls */}
                <div className="flex sm:hidden justify-between w-full">
                  <button
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 self-center">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(p + 1, pagination.totalPages))}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Booking Modal */}
      {bookingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl relative animate-scale-up">
            <h3 className="text-2xl font-extrabold text-slate-950 dark:text-white mb-2">
              {bookingItem.listing_mode === 'rent' ? 'Request Rental' : 'Request Purchase'}
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              You are requesting to {bookingItem.listing_mode === 'rent' ? 'rent' : 'buy'} <span className="font-semibold text-slate-900 dark:text-white">{bookingItem.name}</span>
            </p>

            {bookingError && (
              <div className="mb-5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-sm font-semibold">
                {bookingError}
              </div>
            )}

            {bookingSuccess && (
              <div className="mb-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                {bookingItem.listing_mode === 'rent'
                  ? 'Rental request submitted successfully! Redirecting...'
                  : 'Purchase request submitted successfully! Redirecting...'}
              </div>
            )}

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              {bookingItem.listing_mode === 'rent' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                        setBookingError('')
                      }}
                      min={formatLocalDate(new Date())}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value)
                        setBookingError('')
                      }}
                      min={startDate || formatLocalDate(new Date())}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                    />
                  </div>

                  {/* Price Calculation details */}
                  {startDate && endDate && calculateDays() > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-2 mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Price per Day:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatPrice(bookingItem.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Days:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{calculateDays()} days</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-extrabold text-base text-slate-950 dark:text-white">
                        <span>Estimated Total:</span>
                        <span>{formatPrice(calculateDays() * bookingItem.price)}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between text-slate-900 dark:text-white font-extrabold text-base">
                    <span>Purchase Price:</span>
                    <span>{formatPrice(bookingItem.price)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Click "Confirm Buy" to send a purchase offer to the owner. Once they accept, the item is marked as Sold to you.
                  </p>
                </div>
              )}

              <div className="flex gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setBookingItem(null)}
                  disabled={bookingSubmitting || bookingSuccess}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-center disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting || bookingSuccess || !!bookingError}
                  className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {bookingSubmitting
                    ? 'Submitting...'
                    : bookingItem.listing_mode === 'rent'
                    ? 'Request Rent'
                    : 'Confirm Buy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
