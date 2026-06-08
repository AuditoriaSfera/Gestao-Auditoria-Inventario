'use client'

import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bell, ChevronDown, LogOut, Settings, User, PanelLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/stores/auth'

interface HeaderProps {
  onToggleSidebar: () => void
  title?: string
}

export function Header({ onToggleSidebar, title }: HeaderProps) {
  const router = useRouter()
  const { data: me } = trpc.auth.me.useQuery()
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery()
  const { clearSession } = useAuthStore()

  const handleLogout = () => {
    clearSession()
    router.push('/login')
  }

  const initials = me?.name
    ? me.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-6">
      <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="shrink-0">
        <PanelLeft className="h-5 w-5" />
      </Button>

      {title && (
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Notificações */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => router.push('/notifications')}
        >
          <Bell className="h-5 w-5" />
          {unreadCount != null && unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>

        {/* Usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={me?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">{me?.name ?? 'Carregando...'}</p>
                <p className="text-xs text-muted-foreground">
                  {me?.roles?.[0]?.role?.label ?? ''}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin/parameters')}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
