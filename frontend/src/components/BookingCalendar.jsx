import { useState } from 'react'

export default function BookingCalendar({ reservations, startDate, endDate, onSelectRange }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Helper to check if a Date is today or in the past
  const isPastDate = (date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  // Get all dates in a YYYY-MM-DD range (inclusive) - timezone independent
  const getDatesInRange = (startStr, endStr) => {
    const dates = []
    if (!startStr || !endStr) return dates
    const current = new Date(startStr + 'T00:00:00Z')
    const end = new Date(endStr + 'T00:00:00Z')
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setUTCDate(current.getUTCDate() + 1)
    }
    return dates
  }

  // Create a set of all booked YYYY-MM-DD strings
  const bookedDatesSet = new Set()
  if (reservations) {
    reservations.forEach((r) => {
      getDatesInRange(r.start_date, r.end_date).forEach((dStr) => {
        bookedDatesSet.add(dStr)
      })
    })
  }

  // Days in current month
  const firstDayIndex = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const handleDateClick = (day) => {
    const clickedDate = new Date(year, month, day)
    if (isPastDate(clickedDate)) return

    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (bookedDatesSet.has(dStr)) return

    if (!startDate || (startDate && endDate)) {
      onSelectRange(dStr, '')
    } else {
      // We have a start date, setting the end date
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(dStr + 'T00:00:00')

      if (end < start) {
        onSelectRange(dStr, '')
      } else {
        // Check if there is any booked date in between
        const candidateRange = getDatesInRange(startDate, dStr)
        const hasOverlap = candidateRange.some((dateStr) => bookedDatesSet.has(dateStr))

        if (hasOverlap) {
          alert('Selected range overlaps with already booked dates. Please choose another range.')
        } else {
          onSelectRange(startDate, dStr)
        }
      }
    }
  }

  const daysGrid = []
  // Empty spaces for previous month's padding
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(<div key={`empty-${i}`} className="h-9 w-9"></div>)
  }

  // Days of the month
  for (let day = 1; day <= totalDays; day++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dateObj = new Date(year, month, day)
    const isPast = isPastDate(dateObj)
    const isBooked = bookedDatesSet.has(dStr)
    const isStart = startDate === dStr
    const isEnd = endDate === dStr
    const isInRange = startDate && endDate && dStr > startDate && dStr < endDate

    let btnClass = 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-slate-800 dark:text-slate-200'
    if (isPast) {
      btnClass = 'text-slate-300 dark:text-slate-700 cursor-not-allowed line-through'
    } else if (isBooked) {
      btnClass = 'bg-rose-50 dark:bg-rose-955/20 text-rose-500 cursor-not-allowed border border-rose-200/20 relative'
    } else if (isStart || isEnd) {
      btnClass = 'theme-filter-selected'
    } else if (isInRange) {
      btnClass = 'bg-indigo-500/15 dark:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400 font-extrabold'
    }

    daysGrid.push(
      <button
        key={`day-${day}`}
        type="button"
        disabled={isPast || isBooked}
        onClick={() => handleDateClick(day)}
        className={`h-9 w-9 text-xs font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer ${btnClass}`}
      >
        {day}
        {isBooked && (
          <span className="absolute bottom-1 h-1 w-1 bg-rose-500 rounded-full"></span>
        )}
      </button>
    )
  }

  return (
    <div className="theme-card-muted rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400">
          {monthNames[month]} {year}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-250 dark:hover:bg-slate-800 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-250 dark:hover:bg-slate-800 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysGrid}
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500 block"></span>
          <span>Reserved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-indigo-600 block"></span>
          <span>Selected</span>
        </div>
      </div>
    </div>
  )
}
