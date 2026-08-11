const formatPrice = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value))

function EquipmentCard({ item, onRentClick }) {
  const isRental = item.listing_mode === 'rent'
  const ownerDisplay = item.owner?.username
    ? `@${item.owner.username}`
    : item.owner?.name || 'Unknown'

  return (
    <article className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-700/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
      <div className="h-28 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 dark:from-indigo-950/40 dark:to-violet-950/40 p-4 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 bg-indigo-500/10 rounded-full blur-lg group-hover:scale-125 transition-transform"></div>
        <div className="flex items-start justify-between gap-2 z-10">
          <span className="text-[10px] uppercase tracking-wider font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md border border-indigo-200/30">
            {item.category}
          </span>
          <span className={`text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-full ${
            isRental
              ? 'bg-indigo-600 text-white'
              : 'bg-amber-500 text-slate-950'
          }`}>
            {isRental ? 'FOR RENT' : 'FOR SALE'}
          </span>
        </div>
        <div className="flex items-center justify-between z-10">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            item.availability_status === 'available'
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-900 text-slate-500'
          }`}>
            {item.availability_status === 'available' ? 'Available' : 'Unavailable'}
          </span>
          <span className="text-slate-400 text-xs capitalize font-bold">
            <span className="text-slate-700 dark:text-slate-300">{item.condition}</span> condition
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
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-3">
            Listed by {ownerDisplay}
          </p>
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

          <button
            onClick={isRental && onRentClick ? onRentClick : () => alert(`${item.name} is listed by ${ownerDisplay}.`)}
            className="px-3.5 py-2 text-xs font-bold text-white bg-slate-950 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-500/10"
          >
            {isRental ? 'Rent Now' : 'View Sale'}
          </button>
        </div>
      </div>
    </article>
  )
}

export default EquipmentCard
