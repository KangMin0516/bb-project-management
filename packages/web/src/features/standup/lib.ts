export const DAYS = [
  { value: '1-5', label: 'Mon-Fri' },
  { value: '0-6', label: 'Every day' },
  { value: '1,3,5', label: 'Mon/Wed/Fri' },
  { value: '2,4', label: 'Tue/Thu' },
] as const

export const TIMEZONES = [
  'Asia/Seoul',
  'Asia/Ho_Chi_Minh',
  'Asia/Tokyo',
  'UTC',
  'America/New_York',
] as const

export interface StandupConfigFormData {
  name: string
  channelId: string
  cronHour: string
  cronMinute: string
  cronDayOfWeek: string
  timezone: string
  greeting: string
  goodbye: string
  selectedQuestionIds: string[]
  selectedMemberIds: string[]
}

export const EMPTY_CONFIG_FORM: StandupConfigFormData = {
  name: '',
  channelId: '',
  cronHour: '9',
  cronMinute: '0',
  cronDayOfWeek: '1-5',
  timezone: 'Asia/Seoul',
  greeting: '',
  goodbye: '',
  selectedQuestionIds: [],
  selectedMemberIds: [],
}
