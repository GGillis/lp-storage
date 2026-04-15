import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Disc3, Search, PlusCircle, Compass, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',        icon: Disc3,       label: 'Collection' },
  { to: '/explore', icon: Compass,     label: 'Explore'    },
  { to: '/search',  icon: Search,      label: 'Search'     },
  { to: '/stats',   icon: BarChart2,   label: 'Stats'      },
  { to: '/add',     icon: PlusCircle,  label: 'Add Record' },
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
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-4 border-b"
        style={{ borderColor: 'var(--color-border)', minHeight: '56px' }}
      >
        <Disc3 size={22} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
        {!collapsed && (
          <span
            className="text-sm font-semibold tracking-widest uppercase truncate"
            style={{ color: 'var(--color-accent)' }}
          >
            LP Storage
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'font-medium'
                  : 'hover:opacity-80'
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
