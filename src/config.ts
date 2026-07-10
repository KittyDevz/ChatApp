import { join } from 'path'

export const PORT       = Number(process.env.PORT ?? 3001)
export const ADMIN_KEY  = process.env.ADMIN_KEY ?? 'admin1234'
export const PUBLIC_DIR = join(import.meta.dir, '..', 'public')
