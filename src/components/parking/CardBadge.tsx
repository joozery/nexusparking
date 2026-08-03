import { Car, Bike, Moon } from 'lucide-react'
import { type CardType, cardMeta } from './types'

const icons = { car: Car, motorcycle: Bike, overnight: Moon }

export function CardBadge({ type }: { type: CardType }) {
  const m = cardMeta[type]
  const Icon = icons[type]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${m.bg} ${m.color}`}>
      <Icon className="size-3.5" />
      {m.label}
    </span>
  )
}
