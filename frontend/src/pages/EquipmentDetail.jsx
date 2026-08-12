import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import api from '../services/api'
import { formatApiError } from '../utils/errorFormatter'

const formatPrice = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value))

function EquipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const [item, setItem] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Carousel image index
  const [activeImgIndex, setActiveImgIndex] = useState(0)

  // Booking states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)

  // Review states
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/equipment/${id}`)
        setItem(res.data)
        
        // Default dates: tomorrow to day after
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dayAfter = new Date()
        dayAfter.setDate(dayAfter.getDate() + 2)
        
        setStartDate(tomorrow.toISOString().split('T')[0])
        setEndDate(dayAfter.toISOString().split('T')[0])
      } catch (err) {
        setError(formatApiError(err))
      } finally {
        setLoading(false)
      }
    }

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

    fetchDetails()
    fetchUser()
  }, [id, token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <svg className="animate-spin h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-slate-455 font-bold">Loading equipment specifications...</span>
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 mb-4">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Could Not Load Listing</h2>
          <p className="text-slate-500 max-w-md mb-6">{error || 'The equipment listing you requested does not exist.'}</p>
          <Link to="/" className="px-5 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20 transition-all">
            Return to Explore
          </Link>
        </div>
      </div>
    )
  }

  const isOwner = currentUser?.id === item.owner_id
  const isRental = item.listing_mode === 'rent'
  const isAvailable = item.availability_status === 'available'
  const reservations = item.rental_requests?.filter(r => r.status === 'accepted') || []

  // Check overlap for reservation dates
  const calculateDays = () => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = end - start
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays > 0 ? diffDays : 0
  }

  const handleBookingSubmit = async (e) => {
    e.preventDefault()
    if (!token) {
      navigate('/login')
      return
    }

    let startVal = startDate
    let endVal = endDate

    if (isRental) {
      if (!startDate || !endDate) {
        setBookingError('Please specify booking start and end dates.')
        return
      }

      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate + 'T00:00:00')
      const today = new Date()
      today.setHours(0,0,0,0)

      if (start < today) {
        setBookingError('Start date cannot be in the past.')
        return
      }
      if (start > end) {
        setBookingError('Start date must be on or before end date.')
        return
      }

      // Check date conflicts
      const hasConflict = reservations.some(r => {
        const rStart = new Date(r.start_date + 'T00:00:00')
        const rEnd = new Date(r.end_date + 'T00:00:00')
        return start <= rEnd && end >= rStart
      })

      if (hasConflict) {
        setBookingError('These dates overlap with an existing reservation. Please select other dates.')
        return
      }
    } else {
      const todayStr = new Date().toISOString().split('T')[0]
      startVal = todayStr
      endVal = todayStr
    }

    setBookingSubmitting(true)
    setBookingError('')
    setBookingSuccess(false)

    try {
      await api.post('/rentals', {
        equipment_id: item.id,
        start_date: startVal,
        end_date: endVal
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setBookingSuccess(true)
      setTimeout(() => {
        setBookingSuccess(false)
        navigate('/dashboard')
      }, 1500)
    } catch (err) {
      setBookingError(formatApiError(err))
    } finally {
      setBookingSubmitting(false)
    }
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (!token) {
      navigate('/login')
      return
    }

    if (!comment.trim()) {
      setReviewError('Review comment cannot be empty.')
      return
    }

    setReviewSubmitting(true)
    setReviewError('')
    setReviewSuccess(false)

    try {
      const res = await api.post(`/equipment/${id}/reviews`, {
        rating,
        comment: comment.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // Update reviews list locally
      setItem(prev => ({
        ...prev,
        reviews: [res.data, ...(prev.reviews || [])]
      }))
      setReviewSuccess(true)
      setComment('')
      setRating(5)
      setTimeout(() => setReviewSuccess(false), 2000)
    } catch (err) {
      setReviewError(formatApiError(err))
    } finally {
      setReviewSubmitting(false)
    }
  }

  // Calculate Average Rating
  const avgRating = item.reviews && item.reviews.length > 0
    ? (item.reviews.reduce((sum, r) => sum + r.rating, 0) / item.reviews.length).toFixed(1)
    : null

  const getStatusBadge = () => {
    if (!isAvailable) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200/20">
          {isRental ? 'Unavailable' : 'Sold Out'}
        </span>
      )
    }
    if (isRental && reservations.length > 0) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200/20">
          Reserved
        </span>
      )
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/20">
        Available
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Back Link */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 group cursor-pointer"
        >
          <svg className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Go Back
        </button>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Columns (Specification Gallery, Specs, Reviews) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Gallery Carousel */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200/60 dark:border-slate-700/50 shadow-sm p-4">
              {item.image_urls && item.image_urls.length > 0 ? (
                <div className="space-y-4">
                  {/* Main Display Image */}
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                    <img
                      src={item.image_urls[activeImgIndex].startsWith('http') ? item.image_urls[activeImgIndex] : `http://localhost:8000${item.image_urls[activeImgIndex]}`}
                      alt={`${item.name} zoom`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Navigation Arrows */}
                    {item.image_urls.length > 1 && (
                      <>
                        <button
                          onClick={() => setActiveImgIndex(prev => (prev === 0 ? item.image_urls.length - 1 : prev - 1))}
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/90 dark:bg-slate-800/90 text-slate-850 hover:text-indigo-650 shadow-lg cursor-pointer"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setActiveImgIndex(prev => (prev === item.image_urls.length - 1 ? 0 : prev + 1))}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/90 dark:bg-slate-800/90 text-slate-850 hover:text-indigo-650 shadow-lg cursor-pointer"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Thumbnail Row */}
                  {item.image_urls.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {item.image_urls.map((url, index) => (
                        <button
                          key={index}
                          onClick={() => setActiveImgIndex(index)}
                          className={`relative w-20 aspect-video rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                            index === activeImgIndex ? 'border-indigo-650 scale-[1.02]' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          }`}
                        >
                          <img
                            src={url.startsWith('http') ? url : `http://localhost:8000${url}`}
                            alt={`Thumb ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Falling banner if no images */
                <div className="h-44 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-950/20 dark:to-violet-950/20 flex flex-col items-center justify-center text-slate-400">
                  <svg className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-bold uppercase tracking-wider">No images uploaded for this listing</span>
                </div>
              )}
            </div>

            {/* Specification and Description Card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200/60 dark:border-slate-700/50 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-wider font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-200/20">
                  {item.category}
                </span>
                <span className={`text-[10px] font-extrabold tracking-wider px-3 py-1 rounded-full text-white ${
                  isRental ? 'bg-indigo-600' : 'bg-amber-500'
                }`}>
                  {isRental ? 'FOR RENT' : 'FOR SALE'}
                </span>
                {getStatusBadge()}
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500">
                  {item.condition} condition
                </span>
              </div>

              <div>
                <h1 className="text-3xl font-extrabold text-slate-950 dark:text-white leading-tight">
                  {item.name}
                </h1>
                {avgRating && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <svg key={s} className={`h-4.5 w-4.5 ${s <= Math.round(avgRating) ? 'fill-current' : 'stroke-current fill-none'}`} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.252.583 1.831l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.17 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118l-3.97-2.883c-.778-.58-.378-1.83.582-1.83h4.908a1 1 0 00.95-.69l1.518-4.674z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">{avgRating}</span>
                    <span className="text-xs text-slate-400">({item.reviews?.length} review{item.reviews?.length > 1 ? 's' : ''})</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700/60 pt-6 space-y-2.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Item Details</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed whitespace-pre-line">
                  {item.description || 'No description was provided by the owner.'}
                </p>
              </div>

              {/* Owner Details Card */}
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg shadow-inner">
                  {item.owner?.name?.slice(0, 2).toUpperCase() || 'OP'}
                </div>
                <div>
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-455">Owner Profile</span>
                  <span className="block font-bold text-slate-900 dark:text-white mt-0.5">{item.owner?.name || 'College Student'}</span>
                  <span className="block text-xs text-slate-400 font-medium">@{item.owner?.username || 'user'} • {item.owner?.email || 'No email shared'}</span>
                </div>
              </div>
            </div>

            {/* Reviews Board Section */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200/60 dark:border-slate-700/50 shadow-sm space-y-6">
              <h2 className="text-2xl font-extrabold text-slate-950 dark:text-white">Customer Reviews</h2>
              
              {/* Write a Review (Only if not owner and logged in) */}
              {token && !isOwner && (
                <form onSubmit={handleReviewSubmit} className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-4">
                  <h4 className="text-sm font-bold text-slate-850 dark:text-slate-250 uppercase tracking-wider">Leave a Review</h4>
                  
                  {reviewError && (
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400">{reviewError}</div>
                  )}
                  {reviewSuccess && (
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Review posted successfully!</div>
                  )}

                  {/* Stars Rating Selector */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-450 font-bold">Select Rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <svg className={`h-6 w-6 ${star <= rating ? 'fill-current' : 'stroke-current fill-none'}`} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.252.583 1.831l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.17 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118l-3.97-2.883c-.778-.58-.378-1.83.582-1.83h4.908a1 1 0 00.95-.69l1.518-4.674z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <textarea
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value)
                        setReviewError('')
                      }}
                      placeholder="Write what you think about this equipment (quality, battery life, condition)..."
                      rows="3"
                      className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-600 rounded-xl transition-all cursor-pointer shadow-md disabled:bg-slate-350 disabled:shadow-none"
                  >
                    {reviewSubmitting ? 'Posting...' : 'Post Review'}
                  </button>
                </form>
              )}

              {/* Reviews List */}
              <div className="space-y-4">
                {!item.reviews || item.reviews.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold italic">
                    No reviews left for this equipment yet.
                  </div>
                ) : (
                  item.reviews.map((rev) => (
                    <div key={rev.id} className="p-4 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2 bg-slate-50/30 dark:bg-slate-900/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {rev.reviewer?.name || 'Anonymous'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            @{rev.reviewer?.username || 'user'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(rev.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>

                      {/* Stars */}
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <svg key={s} className={`h-3.5 w-3.5 ${s <= rev.rating ? 'fill-current' : 'stroke-current fill-none'}`} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.252.583 1.831l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.17 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118l-3.97-2.883c-.778-.58-.378-1.83.582-1.83h4.908a1 1 0 00.95-.69l1.518-4.674z" />
                          </svg>
                        ))}
                      </div>

                      <p className="text-xs text-slate-655 dark:text-slate-300 leading-relaxed font-semibold">
                        {rev.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column (Action Box) */}
          <div className="space-y-6">
            
            {/* Booking Card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200/60 dark:border-slate-700/50 shadow-lg space-y-5 sticky top-24">
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isRental ? 'Rental Fee' : 'Purchase Cost'}
                </span>
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 block">
                  {formatPrice(item.price)}
                  {isRental && <span className="text-sm text-slate-400 font-normal"> / day</span>}
                </span>
              </div>

              {bookingError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-xs font-bold text-rose-600 dark:text-rose-455">
                  {bookingError}
                </div>
              )}
              {bookingSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-xs font-bold text-emerald-600 dark:text-emerald-455">
                  Booking request created! Redirecting...
                </div>
              )}

              {isOwner ? (
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-center">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                    Your Listing
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                    Manage booking offers, updates, and status details inside your Dashboard.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  {isRental && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value)
                            setBookingError('')
                          }}
                          className="w-full p-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => {
                            setEndDate(e.target.value)
                            setBookingError('')
                          }}
                          className="w-full p-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Calculations */}
                  {isRental && startDate && endDate && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800 text-xs space-y-2">
                      <div className="flex justify-between font-bold text-slate-550">
                        <span>Daily Rate:</span>
                        <span>{formatPrice(item.price)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-550">
                        <span>Total Days:</span>
                        <span>{calculateDays()} day{calculateDays() !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex justify-between font-extrabold border-t border-slate-200/50 dark:border-slate-700/50 pt-2 text-slate-900 dark:text-white">
                        <span>Estimated Total:</span>
                        <span>{formatPrice(item.price * calculateDays())}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={bookingSubmitting || !isAvailable}
                    className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isAvailable
                        ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 hover:scale-[1.01] active:scale-[0.99]'
                        : 'bg-slate-350 dark:bg-slate-800 text-slate-455 shadow-none pointer-events-none'
                    }`}
                  >
                    {bookingSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending offer...
                      </>
                    ) : (
                      isRental ? 'Submit Rental Request' : 'Submit Purchase Offer'
                    )}
                  </button>
                </form>
              )}

              {/* Reserved Dates calendar details box */}
              {isRental && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 text-xs space-y-2">
                  <span className="block font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Booked Calendar</span>
                  {reservations.length === 0 ? (
                    <p className="text-slate-450 italic">This item has no booked reservations yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {reservations.map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-semibold p-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-150 dark:border-slate-850">
                          <span>📅 {new Date(r.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(r.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded">Reserved</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default EquipmentDetail
