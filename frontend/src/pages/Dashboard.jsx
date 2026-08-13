import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import api from '../services/api'
import { formatApiError } from '../utils/errorFormatter'

const formatPrice = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value))

function Dashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = localStorage.getItem('token')
  
  const [user, setUser] = useState(null)
  const [myEquipment, setMyEquipment] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') === 'rentals' ? 'rentals' : 'listings'
  )
  const [listingSubTab, setListingSubTab] = useState('active') // 'active', 'sold'
  
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
    availability_status: 'available',
    image_urls: []
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Rentals action loading states
  const [actionLoadingId, setActionLoadingId] = useState(null)

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

      // Get Incoming Rentals
      const incomingRes = await api.get('/rentals/incoming', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setIncomingRequests(incomingRes.data)

      // Get Outgoing Rentals
      const outgoingRes = await api.get('/rentals/my-requests', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setOutgoingRequests(outgoingRes.data)

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

  useEffect(() => {
    if (searchParams.get('tab') === 'rentals') {
      setActiveTab('rentals')
    }
  }, [searchParams])

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
      availability_status: 'available',
      image_urls: []
    })
    setFormError('')
    setUploadError('')
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
      availability_status: item.availability_status,
      image_urls: item.image_urls || []
    })
    setFormError('')
    setUploadError('')
    setIsModalOpen(true)
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const invalidFiles = files.filter(file => !file.type.startsWith('image/'))
    if (invalidFiles.length > 0) {
      setUploadError('Please select only valid image files.')
      return
    }

    setUploadingImage(true)
    setUploadError('')

    try {
      const uploadPromises = files.map(async (file) => {
        const uploadData = new FormData()
        uploadData.append('file', file)
        const res = await api.post('/equipment/upload', uploadData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        })
        return res.data.image_url
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      setFormData(prev => ({
        ...prev,
        image_urls: [...(prev.image_urls || []), ...uploadedUrls]
      }))
    } catch (err) {
      console.error(err)
      setUploadError('Failed to upload one or more images. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRemoveImage = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      image_urls: prev.image_urls.filter((_, idx) => idx !== indexToRemove)
    }))
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
        availability_status: formData.availability_status,
        image_urls: formData.image_urls || []
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
      setFormError(formatApiError(err))
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

  // Accept Rental Request
  const handleAcceptRental = async (reqId) => {
    setActionLoadingId(reqId)
    try {
      const res = await api.patch(`/rentals/${reqId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      // Update local state
      setIncomingRequests(incomingRequests.map(req => req.id === reqId ? res.data : req))
    } catch (err) {
      alert(formatApiError(err))
    } finally {
      setActionLoadingId(null)
    }
  }

  // Reject Rental Request
  const handleRejectRental = async (reqId) => {
    if (!window.confirm('Are you sure you want to reject this rental request?')) return
    setActionLoadingId(reqId)
    try {
      const res = await api.patch(`/rentals/${reqId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      // Update local state
      setIncomingRequests(incomingRequests.map(req => req.id === reqId ? res.data : req))
    } catch (err) {
      alert(formatApiError(err))
    } finally {
      setActionLoadingId(null)
    }
  }

  // Cancel Rental Request
  const handleCancelRental = async (reqId) => {
    if (!window.confirm('Are you sure you want to cancel your rental request?')) return
    setActionLoadingId(reqId)
    try {
      const res = await api.patch(`/rentals/${reqId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      // Update local state
      setOutgoingRequests(outgoingRequests.map(req => req.id === reqId ? res.data : req))
    } catch (err) {
      alert(formatApiError(err))
    } finally {
      setActionLoadingId(null)
    }
  }

  // Helper to render status badges
  const renderStatusBadge = (status, listingMode) => {
    const displayStatus = (status === 'accepted' && listingMode === 'sell') ? 'sold' : status
    const styles = {
      pending: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/30',
      accepted: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/30',
      sold: 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/30',
      rejected: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/30',
      cancelled: 'bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200/30',
      completed: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200/30'
    }

    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${styles[displayStatus] || styles.pending}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${
          displayStatus === 'accepted' ? 'bg-emerald-500' :
          displayStatus === 'sold' ? 'bg-rose-500' :
          displayStatus === 'pending' ? 'bg-amber-500' :
          displayStatus === 'rejected' ? 'bg-rose-500' : 'bg-slate-400'
        }`}></span>
        {displayStatus}
      </span>
    )
  }

  // Calculate rental cost helper
  const calculateTotalCost = (start, end, price) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffTime = endDate - startDate
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return formatPrice(days * price)
  }

  const getBookingPeriodStatus = (start, end) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDate = new Date(start + 'T00:00:00')
    const endDate = new Date(end + 'T00:00:00')

    if (today >= startDate && today <= endDate) {
      return { text: 'Active Now', style: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/20' }
    } else if (today < startDate) {
      return { text: 'Upcoming', style: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/20' }
    } else {
      return { text: 'Completed', style: 'bg-slate-100 dark:bg-slate-900 text-slate-500 border border-slate-200/20' }
    }
  }

  // Calculated Stats
  const totalListingsCount = myEquipment.length
  const availableCount = myEquipment.filter(item => item.availability_status === 'available').length
  const totalValue = myEquipment.reduce((sum, item) => sum + Number(item.price), 0)

  const activeListingsList = myEquipment.filter(item => item.availability_status === 'available')
  const soldListingsList = myEquipment.filter(item => item.availability_status !== 'available')
  const displayedListings = listingSubTab === 'active' ? activeListingsList : soldListingsList

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
                  <span className="text-3xl font-extrabold text-slate-950 dark:text-white mt-1 block">{totalListingsCount}</span>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8">
              <button
                onClick={() => setActiveTab('listings')}
                className={`py-3.5 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  activeTab === 'listings'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                My Listings ({myEquipment.length})
              </button>
              <button
                onClick={() => setActiveTab('rentals')}
                className={`py-3.5 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                  activeTab === 'rentals'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Rentals & Bookings ({incomingRequests.length + outgoingRequests.length})
              </button>
            </div>

            {activeTab === 'listings' && (
              <>
                  {myEquipment.length === 0 ? (
                    <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700/30 shadow-sm">
                      <svg className="h-12 w-12 text-slate-300 dark:text-slate-650 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">You haven't listed any equipment yet</h3>
                      <p className="text-slate-505 mt-1 max-w-sm mx-auto text-sm">
                        Click the button above to upload cameras, calculators, lab gear, or textbooks for sharing.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Sub-Tabs: Active vs Sold Out */}
                      <div className="flex gap-2 p-1 bg-slate-105 dark:bg-slate-900/60 rounded-2xl max-w-md">
                        <button
                          type="button"
                          onClick={() => setListingSubTab('active')}
                          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            listingSubTab === 'active'
                              ? 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Active ({activeListingsList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setListingSubTab('sold')}
                          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            listingSubTab === 'sold'
                              ? 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20'
                              : 'text-slate-550 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Sold Out / Reserved ({soldListingsList.length})
                        </button>
                      </div>

                      {displayedListings.length === 0 ? (
                        <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700/30 shadow-sm">
                          <svg className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            No {listingSubTab === 'active' ? 'active' : 'sold out/reserved'} listings found
                          </h4>
                        </div>
                      ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm overflow-hidden animate-fade-in">
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
                                {displayedListings.map((item) => (
                                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors">
                                    <td className="px-6 py-4">
                                      <Link to={`/equipment/${item.id}`} className="font-bold text-slate-900 dark:text-white block text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                        {item.name}
                                      </Link>
                                      <span className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5 max-w-xs">
                                        {item.description || 'No description'}
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
                    </div>
                  )}
                </>
              )}

            {/* TAB CONTENT: Rentals */}
            {activeTab === 'rentals' && (
              <div className="space-y-10 animate-fade-in">
                {/* Section: Lending Schedule Tracker */}
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">Lending Schedule Tracker</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Track your active bookings, schedules, and borrowers at a glance.</p>
                  </div>

                  {incomingRequests.filter(r => r.status === 'accepted').length === 0 ? (
                    <div className="py-10 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700/30 text-sm text-slate-400 font-medium">
                      No lended items or active schedules yet. Accept incoming requests below to start tracking.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {myEquipment
                        .filter(item => incomingRequests.some(r => r.equipment?.id === item.id && r.status === 'accepted'))
                        .map(item => {
                          const itemBookings = incomingRequests
                            .filter(r => r.equipment?.id === item.id && r.status === 'accepted')
                            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))

                          return (
                            <div key={item.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm p-6 space-y-4 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-200/20">
                                      {item.category}
                                    </span>
                                    <Link to={`/equipment/${item.id}`} className="text-base font-extrabold text-slate-950 dark:text-white mt-1.5 block hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                      {item.name}
                                    </Link>
                                  </div>
                                  <span className="text-xs font-bold text-slate-400">
                                    {itemBookings.length} {itemBookings.length === 1 ? 'booking' : 'bookings'}
                                  </span>
                                </div>

                                <div className="space-y-3 mt-4">
                                  {itemBookings.map((b) => {
                                    const periodStatus = getBookingPeriodStatus(b.start_date, b.end_date)
                                    return (
                                      <div key={b.id} className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-4 text-xs">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                                            <span className="font-extrabold text-slate-900 dark:text-white">{b.borrower.name}</span>
                                            <span className="text-[10px] text-slate-400">(@{b.borrower.username || 'borrower'})</span>
                                          </div>
                                          <div className="text-slate-500 font-medium pl-4">
                                            {b.start_date} to {b.end_date}
                                          </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1.5">
                                          <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full ${periodStatus.style}`}>
                                            {periodStatus.text}
                                          </span>
                                          <span className="font-extrabold text-slate-900 dark:text-white">
                                            {item.listing_mode === 'sell'
                                              ? formatPrice(item.price)
                                              : calculateTotalCost(b.start_date, b.end_date, item.price || b.price)}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>

                {/* Section 1: Incoming Requests */}
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">Incoming Rental Requests (Lending)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Requests made by other students to borrow your listed items.</p>
                  </div>

                  {incomingRequests.length === 0 ? (
                    <div className="py-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/30 text-sm text-slate-500">
                      No incoming rental requests.
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              <th className="px-6 py-4">Equipment</th>
                              <th className="px-6 py-4">Borrower</th>
                              <th className="px-6 py-4">Period / Type</th>
                              <th className="px-6 py-4 text-right">Price / Earnings</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
                            {incomingRequests.map((req) => (
                              <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors">
                                <td className="px-6 py-4">
                                  <Link to={`/equipment/${req.equipment?.id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                    {req.equipment?.name || 'Deleted Equipment'}
                                  </Link>
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                                  {req.borrower?.name || 'Borrower'}
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                  {req.equipment?.listing_mode === 'sell' ? (
                                    <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px] bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md border border-amber-200/20">Purchase</span>
                                  ) : (
                                    <span>{req.start_date} to {req.end_date}</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right font-extrabold text-slate-900 dark:text-white">
                                  {req.equipment?.listing_mode === 'sell'
                                    ? formatPrice(req.equipment?.price || req.price)
                                    : calculateTotalCost(req.start_date, req.end_date, req.equipment?.price || req.price)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {renderStatusBadge(req.status, req.equipment?.listing_mode)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {req.status === 'pending' ? (
                                    <div className="inline-flex gap-2">
                                      <button
                                        onClick={() => handleAcceptRental(req.id)}
                                        disabled={actionLoadingId === req.id}
                                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => handleRejectRental(req.id)}
                                        disabled={actionLoadingId === req.id}
                                        className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs font-medium text-slate-400">No actions</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Outgoing Requests */}
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">Your Rental Requests (Borrowing)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Requests you made to borrow other students' equipment.</p>
                  </div>

                  {outgoingRequests.length === 0 ? (
                    <div className="py-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/30 text-sm text-slate-500">
                      No outgoing rental requests.
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              <th className="px-6 py-4">Equipment</th>
                              <th className="px-6 py-4">Owner</th>
                              <th className="px-6 py-4">Period / Type</th>
                              <th className="px-6 py-4 text-right">Price / Cost</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
                            {outgoingRequests.map((req) => (
                              <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors">
                                <td className="px-6 py-4">
                                  <Link to={`/equipment/${req.equipment?.id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                    {req.equipment?.name || 'Deleted Equipment'}
                                  </Link>
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                                  {req.equipment?.owner?.name || 'Owner'}
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                  {req.equipment?.listing_mode === 'sell' ? (
                                    <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px] bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md border border-amber-200/20">Purchase</span>
                                  ) : (
                                    <span>{req.start_date} to {req.end_date}</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right font-extrabold text-slate-900 dark:text-white">
                                  {req.equipment?.listing_mode === 'sell'
                                    ? formatPrice(req.equipment?.price || req.price)
                                    : calculateTotalCost(req.start_date, req.end_date, req.equipment?.price || req.price)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {renderStatusBadge(req.status, req.equipment?.listing_mode)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {(req.status === 'pending' || req.status === 'accepted') ? (
                                    <button
                                      onClick={() => handleCancelRental(req.id)}
                                      disabled={actionLoadingId === req.id}
                                      className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:hover:bg-slate-950 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                      Cancel Request
                                    </button>
                                  ) : (
                                    <span className="text-xs font-medium text-slate-400">No actions</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
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

              {/* Product Image Uploader */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Product Image (Optional)</label>
                {uploadError && (
                  <div className="mb-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                    {uploadError}
                  </div>
                )}
                {/* Thumbnails Grid */}
                {formData.image_urls && formData.image_urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {formData.image_urls.map((url, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 group aspect-video">
                        <img
                          src={url.startsWith('http') ? url : `http://localhost:8000${url}`}
                          alt={`Product preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer"
                            title="Remove Image"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Area */}
                <div className="relative rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 dark:hover:border-indigo-400/50 transition-all bg-slate-50 dark:bg-slate-900 p-6 text-center cursor-pointer flex flex-col items-center justify-center gap-2 group min-h-[120px]">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-xs text-slate-400 font-bold">Uploading images...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="h-8 w-8 text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Click or drag images here to upload multiple</span>
                      <span className="text-[10px] text-slate-400">PNG, JPG, or JPEG (Select one or more)</span>
                    </>
                  )}
                </div>
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
                  className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
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
