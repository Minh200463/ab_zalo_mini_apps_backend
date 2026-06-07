import type { Field } from 'payload'

/** Bỏ dấu tiếng Việt + chuyển về chuỗi URL-friendly. */
export const toSlug = (val: string): string =>
  val
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Field `slug` đơn giản: tự sinh từ field nguồn (mặc định `title`) khi để trống.
 * Tránh dùng slugField built-in (experimental + cần client component trong importMap).
 */
export const slugField = (source = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  index: true,
  admin: {
    position: 'sidebar',
    description: `Để trống sẽ tự sinh từ "${source}".`,
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (value) return toSlug(String(value))
        const src = data?.[source]
        return src ? toSlug(String(src)) : value
      },
    ],
  },
})
