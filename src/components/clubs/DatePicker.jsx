import { useI18n } from '@/lib/i18n'

const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toLocalISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function DatePicker({ selectedDate, onSelect }) {
  const { lang } = useI18n()
  const dayNames = lang === 'es' ? DAY_NAMES_ES : DAY_NAMES_EN

  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    dates.push(d)
  }

  const todayISO = toLocalISO(new Date())

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {dates.map((d) => {
        const iso = toLocalISO(d)
        const isSelected = iso === selectedDate
        const isToday = iso === todayISO

        return (
          <button
            key={iso}
            onClick={() => onSelect(iso)}
            className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-all ${
              isSelected
                ? 'bg-emerald-500/20 border border-emerald-500/40'
                : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {dayNames[d.getDay()]}
            </span>
            <span className={`text-lg font-black ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
              {d.getDate()}
            </span>
            {isToday && (
              <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            )}
          </button>
        )
      })}
    </div>
  )
}
