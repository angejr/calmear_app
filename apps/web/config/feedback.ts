/**
 * Choices offered by the /feedback and /uninstalled forms.
 *
 * Shared by the pages and the API: the server only accepts these keys.
 * Keys are stored in the database, so keep them stable when editing labels.
 */
export const FEEDBACK_TOPICS = [
  { key: 'bug', label: 'Something isn\'t working' },
  { key: 'missed', label: 'CalmEar missed some mouth sounds' },
  { key: 'idea', label: 'An idea or a request' },
  { key: 'question', label: 'A question' },
  { key: 'other', label: 'Something else' },
] as const

export const UNINSTALL_REASONS = [
  { key: 'not_enough', label: 'It didn\'t reduce mouth sounds enough' },
  { key: 'audio_quality', label: 'It changed how videos sound' },
  { key: 'setup', label: 'I couldn\'t get it working or sign in' },
  { key: 'performance', label: 'It slowed down my computer or browser' },
  { key: 'price', label: 'I don\'t want to pay after the trial' },
  { key: 'trying', label: 'I was just trying it out' },
  { key: 'other', label: 'Another reason' },
] as const

export type FeedbackSource = 'feedback' | 'uninstall'

export const FEEDBACK_LIMITS = {
  message: 2000,
  email: 254,
  extensionVersion: 32,
} as const
