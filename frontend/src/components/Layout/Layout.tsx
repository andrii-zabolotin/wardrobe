import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useDevStore } from '../../store/devStore';
import { DevModeToggle } from '../DevMode';
import { Shirt, UserCircle, LayoutDashboard, Sparkles, Image as ImageIcon, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { name: 'Wardrobe', href: '/wardrobe', icon: Shirt },
  { name: 'Outfit Board', href: '/outfits', icon: LayoutDashboard },
  { name: 'Stylist', href: '/stylist', icon: Sparkles },
  { name: 'Avatars', href: '/avatars', icon: UserCircle },
  { name: 'Gallery', href: '/gallery', icon: ImageIcon },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const fetchDevMode = useDevStore(state => state.fetchDevMode);

  useEffect(() => {
    fetchDevMode();
  }, [fetchDevMode]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="h-16 flex items-center justify-between px-6 border-b">
          <h1 className="text-xl font-bold tracking-tight">Wardrobe Try-On</h1>
        </div>
        <div className="px-6 py-2 border-b">
          <DevModeToggle />
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/20">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
