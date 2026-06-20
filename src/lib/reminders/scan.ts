export function isDue(reminder: { remindAt: string; status: string }, now: Date = new Date()): boolean {
  return reminder.status === 'pending' && new Date(reminder.remindAt).getTime() <= now.getTime()
}
