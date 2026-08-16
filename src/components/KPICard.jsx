export default function KPICard({ label, value, sub, valueClass = 'text-slate-900 dark:text-slate-100', icon: Icon, iconBg = 'bg-blue-50 dark:bg-blue-900/30', iconColor = 'text-blue-600 dark:text-blue-400' }) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon size={16} className={iconColor} />
          </div>
        )}
      </div>
      <div>
        <p className={`text-2xl font-bold leading-tight tracking-tight ${valueClass}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
      </div>
    </div>
  )
}
