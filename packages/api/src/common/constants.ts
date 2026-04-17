export const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
} as const;

export const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  status: true,
  isSuperuser: true,
  createdAt: true,
} as const;
