import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Search from './pages/Search'
import AddRecord from './pages/AddRecord'
import Explore from './pages/Explore'
import Stats from './pages/Stats'
import GamesHome from './pages/games/Home'
import GamesSearch from './pages/games/Search'
import AddGame from './pages/games/AddGame'
import GamesExplore from './pages/games/Explore'
import GamesStats from './pages/games/Stats'
import { useCollection } from './context/CollectionContext'
import Admin from './pages/Admin'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { collection } = useCollection()

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header
          className="flex items-center gap-3 px-4 py-3 md:hidden border-b"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--color-muted)' }}
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-medium tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
            {collection === 'games' ? 'Games' : 'LP Storage'}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/add" element={<AddRecord />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/games" element={<GamesHome />} />
            <Route path="/games/search" element={<GamesSearch />} />
            <Route path="/games/add" element={<AddGame />} />
            <Route path="/games/explore" element={<GamesExplore />} />
            <Route path="/games/stats" element={<GamesStats />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
