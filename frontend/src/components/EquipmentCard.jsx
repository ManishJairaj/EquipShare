import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../services/api'
import { formatDate } from '../utils/dateFormatter'

const formatPrice = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value))

function EquipmentCard({ item, onRentClick, isOwner }) {
  const navigate = useNavigate()
  const [showCalendar, setShowCalendar] = useState(false)
  const isRental = item.listing_mode === 'rent'
  const isAvailable = item.availability_status === 'available'
  
  const ownerDisplay = item.owner?.username
    ? `@${item.owner.username}`
    : item.owner?.name || 'Unknown'

  // Filter for accepted rental ranges
  const acceptedRentals = item.rental_requests
    ? item.rental_requests.filter((r) => r.status === 'accepted')
    : []

  // Custom status and badge colors
  const getBadgeStyles = () => {
    if (!isAvailable) {
      if (!isRental) {
        return 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200/20'
      } else {
        return 'bg-slate-100 dark:bg-slate-900 text-slate-500 border border-slate-200/20'
      }
    }
    // If it is a rent listing and has active accepted reservations, show Reserved status
    if (isRental && acceptedRentals.length > 0) {
      return 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200/20'
    }
    return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/20'
  }

  const getStatusText = () => {
    if (!isAvailable) {
      return !isRental ? 'Sold' : 'Unavailable'
    }
    if (isRental && acceptedRentals.length > 0) {
      return 'Reserved'
    }
    return 'Available'
  }

  const getButtonText = () => {
    if (!isAvailable) {
      return !isRental ? 'Sold Out' : 'Unavailable'
    }
    return isRental ? 'Rent Now' : 'Buy Now'
  }

  // Format date nicely: e.g. "12/08/2026"
  const formatDateFriendly = (dateStr) => {
    return formatDate(dateStr)
  }

  // The button should only be disabled if availability_status is manually set to "unavailable" (or it is sold)
  const isButtonDisabled = !isAvailable

  const hasImages = item.image_urls && item.image_urls.length > 0

  const getCategoryBadgeClass = () => {
    const category = item.category?.toLowerCase() || ''
    if (category.includes('camera') || category.includes('photo')) return 'theme-badge-lavender'
    if (category.includes('electronic') || category.includes('calculator')) return 'theme-badge-blue'
    if (category.includes('book')) return 'theme-badge-yellow'
    if (category.includes('sport')) return 'theme-badge-mint'
    return 'theme-badge-peach'
  }

  return (
    <article 
      onClick={() => navigate(`/equipment/${item.id}`)}
      className="theme-card bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-700/50 hover:-translate-y-1 transition-all duration-300 flex flex-col group cursor-pointer"
    >
      <div className="h-40 bg-[var(--accent-blue)] p-4 flex flex-col justify-between relative overflow-hidden">
        {hasImages && (
          <>
            <img 
              src={item.image_urls[0].startsWith('http') ? item.image_urls[0] : `${API_BASE_URL}${item.image_urls[0]}`} 
              alt={item.name} 
              className="absolute inset-0 w-full h-full object-cover z-0" 
            />
            <div className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/50 z-0"></div>
          </>
        )}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 bg-indigo-500/10 rounded-full blur-lg group-hover:scale-125 transition-transform z-10"></div>
        <div className="flex items-start justify-between gap-2 z-10 w-full">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${getBadgeStyles()}`}>
            {getStatusText()}
          </span>
          <span className={`text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-md ${
            isRental
              ? 'theme-badge-lavender'
              : 'theme-badge-peach'
          }`}>
            {isRental ? 'RENT' : 'SELL'}
          </span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] uppercase tracking-widest font-extrabold px-2 py-0.5 rounded-md ${getCategoryBadgeClass()}`}>
              {item.category}
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-450 font-bold uppercase tracking-wider">
              {item.condition} Condition
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {item.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 min-h-[2rem]">
            {item.description || 'No description provided by the owner.'}
          </p>
          
          <div className="flex items-center justify-between mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <span>Listed by {ownerDisplay}</span>
            
            {/* Availability Calendar Toggle (Only for rentals) */}
            {isRental && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowCalendar(!showCalendar)
                }}
                className="text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {showCalendar ? 'Hide Dates' : 'Booked Dates'}
              </button>
            )}
          </div>

          {/* Booked Dates dropdown */}
          {isRental && showCalendar && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 animate-slide-down"
            >
              <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">📅 Reserved Dates:</span>
              {acceptedRentals.length === 0 ? (
                <span className="text-slate-400 block italic">No active reservations</span>
              ) : (
                <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {acceptedRentals.map((r, idx) => (
                    <li key={idx} className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>• {formatDateFriendly(r.start_date)} to {formatDateFriendly(r.end_date)}</span>
                      <span className="text-[9px] uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded">Booked</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold block">
              {isRental ? 'PRICE PER DAY' : 'SELLING PRICE'}
            </span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">
              {formatPrice(item.price)}
              {isRental && <span className="text-xs text-slate-400 font-normal">/day</span>}
            </span>
          </div>

          {isOwner ? (
            <span className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl select-none uppercase tracking-wider">
              Your Listing
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!isButtonDisabled && onRentClick) onRentClick()
              }}
              disabled={isButtonDisabled}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                !isButtonDisabled
                  ? 'theme-secondary-button'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 shadow-none pointer-events-none'
              }`}
            >
              {getButtonText()}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default EquipmentCard
