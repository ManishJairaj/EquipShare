import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar.jsx'
import api from '../services/api'

function Home() {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  useEffect(() => {
    fetchEquipment()
  }, [])

  const fetchEquipment = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/equipment')
      setEquipment(res.data)
    } catch (err) {
      setError('Failed to fetch equipment listings.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Get unique categories for filter
  const categories = ['All', ...new Set(equipment.map(item => item.category))]

  // Filter listings based on search and category
  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

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
            <div className="relative flex items-center bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-xl border border-slate-200/55 dark:border-slate-700/50">
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
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-950 dark:text-white">Available Equipment</h2>
            <p className="text-sm text-slate-500 mt-1">Browse and filter campus listings</p>
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
        ) : filteredEquipment.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700/30 shadow-sm">
            <svg className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Equipment Found</h3>
            <p className="text-slate-500 mt-1 max-w-sm mx-auto text-sm">
              We couldn't find any matches. Try adjusting your search query or category filters.
            </p>
          </div>
        ) : (
          /* Equipment Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEquipment.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-700/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group"
              >
                {/* Visual Category Header representation */}
                <div className="h-28 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 dark:from-indigo-950/40 dark:to-violet-950/40 p-4 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 bg-indigo-500/10 rounded-full blur-lg group-hover:scale-125 transition-transform"></div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md self-start border border-indigo-200/30">
                    {item.category}
                  </span>
                  <div className="flex items-center justify-between z-10">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      item.availability_status === 'available'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-500'
                    }`}>
                      {item.availability_status === 'available' ? 'Available' : 'Reserved'}
                    </span>
                    <span className="text-slate-400 text-xs capitalize font-bold">
                      Condition: <span className="text-slate-700 dark:text-slate-300">{item.condition}</span>
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 min-h-[2rem]">
                      {item.description || 'No description provided by the owner.'}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-bold block">PRICE</span>
                      <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                        ${item.price_per_day}
                        <span className="text-xs text-slate-400 font-normal"> / day</span>
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => alert(`To book ${item.name}, please register/login and contact the owner.`)}
                      className="px-3.5 py-2 text-xs font-bold text-white bg-slate-950 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/10"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default Home
