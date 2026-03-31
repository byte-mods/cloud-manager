import { describe, it, expect, beforeEach } from 'vitest'
import { useNotificationStore } from '@/stores/notification-store'

describe('notification-store', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 })
  })

  it('has correct initial state', () => {
    const state = useNotificationStore.getState()
    expect(state.notifications).toEqual([])
    expect(state.unreadCount).toBe(0)
  })

  it('addNotification adds to array and increments unreadCount', () => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: 'Test',
      message: 'Test message',
    })
    const state = useNotificationStore.getState()
    expect(state.notifications).toHaveLength(1)
    expect(state.unreadCount).toBe(1)
    expect(state.notifications[0].title).toBe('Test')
    expect(state.notifications[0].message).toBe('Test message')
    expect(state.notifications[0].type).toBe('info')
    expect(state.notifications[0].read).toBe(false)
    expect(state.notifications[0].id).toBeDefined()
    expect(state.notifications[0].createdAt).toBeInstanceOf(Date)
  })

  it('addNotification prepends new notifications', () => {
    const store = useNotificationStore.getState()
    store.addNotification({ type: 'info', title: 'First', message: 'msg' })
    useNotificationStore.getState().addNotification({ type: 'warning', title: 'Second', message: 'msg' })
    const state = useNotificationStore.getState()
    expect(state.notifications).toHaveLength(2)
    expect(state.unreadCount).toBe(2)
    expect(state.notifications[0].title).toBe('Second')
    expect(state.notifications[1].title).toBe('First')
  })

  it('markAsRead marks notification and decrements count', () => {
    useNotificationStore.getState().addNotification({ type: 'info', title: 'Test', message: 'msg' })
    const id = useNotificationStore.getState().notifications[0].id
    useNotificationStore.getState().markAsRead(id)
    const state = useNotificationStore.getState()
    expect(state.notifications[0].read).toBe(true)
    expect(state.unreadCount).toBe(0)
  })

  it('markAsRead on already-read notification does not change count', () => {
    useNotificationStore.getState().addNotification({ type: 'info', title: 'Test', message: 'msg' })
    const id = useNotificationStore.getState().notifications[0].id
    useNotificationStore.getState().markAsRead(id)
    useNotificationStore.getState().markAsRead(id)
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('markAsRead with unknown id does nothing', () => {
    useNotificationStore.getState().addNotification({ type: 'info', title: 'Test', message: 'msg' })
    useNotificationStore.getState().markAsRead('nonexistent-id')
    const state = useNotificationStore.getState()
    expect(state.unreadCount).toBe(1)
    expect(state.notifications[0].read).toBe(false)
  })

  it('markAllAsRead marks all and sets count to 0', () => {
    const store = useNotificationStore.getState()
    store.addNotification({ type: 'info', title: 'A', message: 'a' })
    useNotificationStore.getState().addNotification({ type: 'warning', title: 'B', message: 'b' })
    useNotificationStore.getState().addNotification({ type: 'error', title: 'C', message: 'c' })
    useNotificationStore.getState().markAllAsRead()
    const state = useNotificationStore.getState()
    expect(state.unreadCount).toBe(0)
    expect(state.notifications.every((n) => n.read)).toBe(true)
  })

  it('clearAll empties array and resets count', () => {
    const store = useNotificationStore.getState()
    store.addNotification({ type: 'info', title: 'A', message: 'a' })
    useNotificationStore.getState().addNotification({ type: 'warning', title: 'B', message: 'b' })
    useNotificationStore.getState().clearAll()
    const state = useNotificationStore.getState()
    expect(state.notifications).toEqual([])
    expect(state.unreadCount).toBe(0)
  })

  it('supports optional resourceId and module fields', () => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title: 'Module Issue',
      message: 'msg',
      resourceId: 'res-123',
      module: 'compute',
    })
    const n = useNotificationStore.getState().notifications[0]
    expect(n.resourceId).toBe('res-123')
    expect(n.module).toBe('compute')
  })
})
