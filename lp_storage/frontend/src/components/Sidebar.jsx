import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Disc3, Search, PlusCircle, Compass, BarChart2, ChevronLeft, ChevronRight, Gamepad2 } from 'lucide-react'
import { useCollection } from '../context/CollectionContext'

const RECORDS_NAV = [
  { to: '/',        icon: Disc3,       label: 'Collection' },
  { to: '/explore', icon: Compass,     label: 'Explore'    },
  { to: '/search',  icon: Search,      label: 'Search'     },
  { to: '/stats',   icon: BarChart2,   label: 'Stats'      },
  { to: '/add',     icon: PlusCircle,  label: 'Add Record' },
]

const GAMES_NAV = [
  { to: '/games',         icon: Gamepad2,   label: 'Collection' },
  { to: '/games/explore', icon: Compass,    label: 'Explore'    },
  { to: '/games/search',  icon: Search,     label: 'Search'     },
  { to: '/games/stats',   icon: BarChart2,  label: 'Stats'      },
  { to: '/games/add',     icon: PlusCircle, label: 'Add Game'   },
]

export default function Sidebar({ isOpen, onClose }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col border-r shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? '60px' : '200px',
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
        />
      </aside>

      {/* Mobile sidebar (slide-in overlay) */}
      <aside
        className="fixed inset-y-0 left-0 z-30 flex flex-col w-56 border-r md:hidden transition-transform duration-200"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <SidebarContent collapsed={false} onClose={onClose} />
      </aside>
    </>
  )
}

function SidebarContent({ collapsed, onToggleCollapse, onClose }) {
  const { collection, setCollection } = useCollection()
  const navItems = collection === 'games' ? GAMES_NAV : RECORDS_NAV

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-4 border-b"
        style={{ borderColor: 'var(--color-border)', minHeight: '56px' }}
      >
        {collection === 'games'
          ? <Gamepad2 size={22} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          : <Disc3 size={22} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
        }
        {!collapsed && (
          <span
            className="text-sm font-semibold tracking-widest uppercase truncate"
            style={{ color: 'var(--color-accent)' }}
          >
            {collection === 'games' ? 'Games' : 'LP Storage'}
          </span>
        )}
      </div>

      {/* Collection switcher */}
      {!collapsed && (
        <div className="px-2 pt-2">
          <div
            className="flex rounded-md p-0.5 gap-0.5"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            <button
              onClick={() => setCollection('records')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors"
              style={{
                background: collection === 'records' ? 'var(--color-accent)' : 'transparent',
                color: collection === 'records' ? '#000' : 'var(--color-muted)',
              }}
            >
              <Disc3 size={12} /> Records
            </button>
            <button
              onClick={() => setCollection('games')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors"
              style={{
                background: collection === 'games' ? 'var(--color-accent)' : 'transparent',
                color: collection === 'games' ? '#000' : 'var(--color-muted)',
              }}
            >
              <Gamepad2 size={12} /> Games
            </button>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="px-2 pt-2 flex flex-col gap-1">
          <button
            onClick={() => setCollection('records')}
            className="flex items-center justify-center p-2 rounded-md transition-colors"
            style={{
              background: collection === 'records' ? 'var(--color-accent)' : 'transparent',
              color: collection === 'records' ? '#000' : 'var(--color-muted)',
            }}
            title="Records"
          >
            <Disc3 size={16} />
          </button>
          <button
            onClick={() => setCollection('games')}
            className="flex items-center justify-center p-2 rounded-md transition-colors"
            style={{
              background: collection === 'games' ? 'var(--color-accent)' : 'transparent',
              color: collection === 'games' ? '#000' : 'var(--color-muted)',
            }}
            title="Games"
          >
            <Gamepad2 size={16} />
          </button>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex flex-col gap-1 p-2 flex-1 mt-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/games'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                isActive ? 'font-medium' : 'hover:opacity-80'
              }`
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--color-card)' : 'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
            })}
          >
            <Icon size={18} style={{ flexShrink: 0 }} />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle — desktop only */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center p-3 border-t transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </div>
  )
}
