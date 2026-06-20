'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Register' },
  { href: '/cases', label: 'Cases' },
  { href: '/clients', label: 'Clients' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`px-3 py-2 text-xs font-mono uppercase tracking-widest border-l-2 transition-colors ${
              active
                ? 'border-seal text-seal'
                : 'border-transparent text-ink-soft hover:text-seal hover:border-rule'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between border-b border-rule px-4 py-3">
        <Link href="/" className="font-display text-lg tracking-tight">
          Smart Vakeel
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="text-ink-soft hover:text-seal transition-colors text-xs font-mono uppercase tracking-widest border border-rule px-2 py-1"
        >
          Menu
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-paper-deep border-r border-rule p-4 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="font-display text-lg tracking-tight">Smart Vakeel</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="text-ink-soft hover:text-seal transition-colors text-xs font-mono uppercase tracking-widest"
              >
                Close
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:border-r md:border-rule md:min-h-screen md:bg-paper-deep">
        <div className="px-4 py-6">
          <Link href="/" className="font-display text-xl tracking-tight">
            Smart Vakeel
          </Link>
        </div>
        <div className="px-1">
          <NavLinks pathname={pathname} />
        </div>
      </aside>
    </>
  )
}
