import { Zap, Crown, TrendingUp } from 'lucide-react'
import GlobalCounter from '@/components/ui/GlobalCounter'

const PROPS = [
  { Icon: Zap,         text: 'Save every score forever'   },
  { Icon: Crown,       text: 'Climb the global leaderboard' },
  { Icon: TrendingUp,  text: 'Track your reaction time'   },
]

export default function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-center items-center w-1/2 bg-black border-r border-white/5 p-12 gap-10">
      <div className="text-center space-y-3">
        <h1 className="text-6xl font-black tracking-tight">
          <span className="text-white">DAB</span>
          <span className="text-purple-400"> POSE</span>
        </h1>
        <p className="text-gray-400 text-xl">How fast can you dab?</p>
      </div>

      <ul className="w-full max-w-xs space-y-3">
        {PROPS.map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-gray-300 text-sm">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Icon size={16} />
            </span>
            {text}
          </li>
        ))}
      </ul>

      <GlobalCounter />
    </div>
  )
}
