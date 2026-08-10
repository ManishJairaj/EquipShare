import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import api from '../services/api'

const formatPrice = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value))

function Dashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  
  const [user, setUser] = useState(null)
  const [myEquipment, setMyEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Form states for adding/editing equipment
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null) // null for create, object for edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    condition: 'good',
    listing_mode: 'rent',
    price: '',
    availability_status: 'available'
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Get User Info
      const userRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUser(userRes.data)

      // Get My Listings
      const equipRes = await api.get('/equipment/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMyEquipment(equipRes.data)
    } catch (err) {
      console.error(err)
      setError('Session expired or authentication failed. Please login again.')
      localStorage.removeItem('token')
      navigate('/login')
    } finally {
      setLoading(false)
    }
  }, [token, navigate])

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    fetchData()
  }, [token, navigate, fetchData])

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setFormError('')
  }

  const openAddModal = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      description: '',
      category: '',
      condition: 'good',
      listing_mode: 'rent',
      price: '',
      availability_status: 'available'
    })
    setIsModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      condition: item.condition,
      listing_mode: item.listing_mode,
      price: item.price,
      availability_status: item.availability_status
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.category || !formData.price) {
      setFormError('Name, Category, and Price are required.')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        category: formData.category,
        condition: formData.condition,
        listing_mode: formData.listing_mode,
        price: parseFloat(formData.price),
        availability_status: formData.availability_status
      }

      if (editingItem) {
        // Update Equipment
        const res = await api.patch(`/equipment/${editingItem.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
        // Update local state
        setMyEquipment(myEquipment.map(item => item.id === editingItem.id ? res.data : item))
      } else {
        // Create Equipment
        const res = await api.post('/equipment', payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
        // Add to local state
        setMyEquipment([...myEquipment, res.data])
      }

      setIsModalOpen(false)
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save equipment. Check database types.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (itemId, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      await api.delete(`/equipment/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMyEquipment(myEquipment.filter(item => item.id !== itemId))
    } catch (err) {
      console.error(err)
      alert('Failed to delete equipment listing.')
    }
  }

  // Calculated Stats
  const activeListings = myEquipment.length
  const availableCount = myEquipment.filter(item => item.availability_status === 'available').length
  const totalValue = myEquipment.reduce((sum, item) => sum + Number(item.price), 0)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <svg className="animate-spin h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-slate-500 font-bold">Loading dashboard...</span>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-center font-semibold">
            {error}
          </div>
        ) : (
          <>
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-950 dark:text-white">
                  Welcome, {user?.name}!
                </h1>
                <p className="text-sm text-slate-500 mt-1">Manage your equipment listings and bookings</p>
              </div>

              <button
                onClick={openAddModal}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/20 self-start cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                List New Equipment
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Total Items Listed</span>
                  <span className="text-3xl font-extrabold text-slate-950 dark:text-white mt-1 block">{activeListings}</span>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Available Status</span>
                  <span className="text-3xl font-extrabold text-slate-950 dark:text-white mt-1 block">{availableCount}</span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Total Listed Value</span>
                  <span className="text-3xl font-extrabold text-slate-950 dark:text-white mt-1 block">{formatPrice(totalValue)}</span>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Listings Header */}
            <h2 className="text-xl font-bold text-slate-950 dark:text-white mb-6">Your Equipment Listings</h2>

            {myEquipment.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700/30 shadow-sm">
                <svg className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">You haven't listed any equipment yet</h3>
                <p className="text-slate-500 mt-1 max-w-sm mx-auto text-sm">
                  Click the button above to upload cameras, calculators, lab gear, or textbooks for sharing.
                </p>
              </div>
            ) : (
              /* Table Layout */
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <th className="px-6 py-4">Equipment Info</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Listing Type</th>
                        <th className="px-6 py-4">Condition</th>
                        <th className="px-6 py-4">Availability</th>
                        <th className="px-6 py-4 text-right">Price</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {myEquipment.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900 dark:text-white block text-sm">{item.name}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5 max-w-xs">
                              {item.description || 'No description'}
                            </span>
                            <span className="text-xs text-indigo-500 dark:text-indigo-400 mt-1 block">
                              Listed by {item.owner?.username ? `@${item.owner.username}` : item.owner?.name || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">{item.category}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-full ${
                              item.listing_mode === 'rent'
                                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                            }`}>
                              {item.listing_mode === 'rent' ? 'FOR RENT' : 'FOR SALE'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 capitalize">
                              {item.condition}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                              item.availability_status === 'available'
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-slate-900 text-slate-500'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                item.availability_status === 'available' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}></span>
                              {item.availability_status === 'available' ? 'Available' : 'Reserved'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-extrabold text-slate-900 dark:text-white text-sm">
                            {formatPrice(item.price)}
                            {item.listing_mode === 'rent' && <span className="text-xs text-slate-400 font-normal">/day</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.name)}
                                className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* List / Edit Equipment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl relative animate-scale-up">
            <h3 className="text-2xl font-extrabold text-slate-950 dark:text-white mb-6">
              {editingItem ? 'Edit Equipment Listing' : 'List New Equipment'}
            </h3>

            {formError && (
              <div className="mb-5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-sm font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Equipment Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Sony a6400 Camera"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Category</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="e.g. Cameras, Calculators"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Listing Type</label>
                  <select
                    name="listing_mode"
                    value={formData.listing_mode}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                  >
                    <option value="rent">Rent</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Condition</label>
                  <select
                    name="condition"
                    value={formData.condition}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                  >
                    <option value="new">New</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Status</label>
                  <select
                    name="availability_status"
                    value={formData.availability_status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                  >
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable (Reserved)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {formData.listing_mode === 'rent' ? 'Price Per Day (₹)' : 'Selling Price (₹)'}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder={formData.listing_mode === 'rent' ? 'e.g. 500' : 'e.g. 15000'}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description (Optional)</label>
                <textarea
                  name="description"
                  rows="3"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Provide detail on what is included, pickup location, or borrowing guidelines."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none"
                />
              </div>

              <div className="flex gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  {submitting ? 'Saving...' : 'Save Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
