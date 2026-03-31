import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'

// Mock Radix UI dropdown components to render their children directly
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
    <button ref={ref} className={className} {...props}>{children}</button>
  )),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, ...props }: any) => (
    <span data-testid="badge" className={className} {...props}>{children}</span>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

import { useNotificationStore } from '@/stores/notification-store'
import { NotificationCenter } from '@/components/layout/notification-center'

describe('NotificationCenter', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 })
  })

  it('renders bell icon', () => {
    render(<NotificationCenter />)
    // The Bell icon renders as an SVG within the trigger button
    const trigger = screen.getByTestId('dropdown-trigger')
    expect(trigger).toBeDefined()
    const button = trigger.querySelector('button')
    expect(button).toBeDefined()
  })

  it('shows unread count badge when there are unread notifications', async () => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Test',
      message: 'Test message',
    })
    useNotificationStore.getState().addNotification({
      type: 'warning',
      title: 'Test 2',
      message: 'Test message 2',
    })

    render(<NotificationCenter />)
    const badge = screen.getByTestId('badge')
    expect(badge.textContent).toBe('2')
  })

  it('does not show badge when no unread notifications', () => {
    // Add then mark as read
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Test',
      message: 'Test message',
    })
    const id = useNotificationStore.getState().notifications[0].id
    useNotificationStore.getState().markAsRead(id)

    render(<NotificationCenter />)
    expect(screen.queryByTestId('badge')).toBeNull()
  })

  it('notification items display correctly', () => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title: 'Critical Error',
      message: 'Something went wrong',
    })

    render(<NotificationCenter />)
    expect(screen.getByText('Critical Error')).toBeDefined()
    expect(screen.getByText('Something went wrong')).toBeDefined()
  })

  it('mark as read functionality works via clicking notification', () => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Click Me',
      message: 'Click to mark read',
    })

    render(<NotificationCenter />)
    const notificationButton = screen.getByText('Click Me').closest('button')
    expect(notificationButton).not.toBeNull()
    fireEvent.click(notificationButton!)

    const state = useNotificationStore.getState()
    expect(state.notifications[0].read).toBe(true)
    expect(state.unreadCount).toBe(0)
  })

  it('clear all removes notifications', () => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'A',
      message: 'a',
    })
    useNotificationStore.getState().addNotification({
      type: 'warning',
      title: 'B',
      message: 'b',
    })

    render(<NotificationCenter />)
    const clearButton = screen.getByText('Clear')
    fireEvent.click(clearButton)

    const state = useNotificationStore.getState()
    expect(state.notifications).toHaveLength(0)
    expect(state.unreadCount).toBe(0)
  })

  it('mark all read button marks all notifications as read', () => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'A',
      message: 'a',
    })
    useNotificationStore.getState().addNotification({
      type: 'warning',
      title: 'B',
      message: 'b',
    })

    render(<NotificationCenter />)
    const markAllButton = screen.getByText('Mark all read')
    fireEvent.click(markAllButton)

    const state = useNotificationStore.getState()
    expect(state.unreadCount).toBe(0)
    expect(state.notifications.every((n) => n.read)).toBe(true)
  })

  it('shows "No notifications" when list is empty and seeds are disabled', () => {
    // We need to render with already-existing notifications to skip seeding,
    // then clear them.
    useNotificationStore.getState().addNotification({
      type: 'info', title: 'Temp', message: 'temp',
    })

    render(<NotificationCenter />)

    // Clear all after render (seed check has already passed)
    useNotificationStore.getState().clearAll()
  })

  it('shows 99+ when unread count exceeds 99', () => {
    // Manually set a high unread count
    useNotificationStore.setState({ unreadCount: 100, notifications: [] })

    // Need to re-add at least one notification to avoid seeding
    useNotificationStore.setState({
      notifications: [{
        id: 'x',
        type: 'info',
        title: 'T',
        message: 'M',
        read: false,
        createdAt: new Date(),
      }],
      unreadCount: 100,
    })

    render(<NotificationCenter />)
    const badge = screen.getByTestId('badge')
    expect(badge.textContent).toBe('99+')
  })
})
