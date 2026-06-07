import React from 'react'

const LOGO_URL = 'https://logo-zp.zdn.vn/app/8164ce37f072192c4063_2_1.jpg'

// Logo hiển thị ở màn đăng nhập/đăng xuất admin (kích thước lớn).
// width = height + objectFit: contain để giữ tỉ lệ, ảnh vuông hay chữ nhật đều không bị méo/tràn.
export const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <img
      src={LOGO_URL}
      alt="AntD2C"
      width={56}
      height={56}
      style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }}
    />
    <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>AntD2C</span>
  </div>
)

// Icon hiển thị ở góc trên thanh điều hướng admin (kích thước nhỏ).
export const Icon = () => (
  <img
    src={LOGO_URL}
    alt="AntD2C"
    width={28}
    height={28}
    style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, display: 'block' }}
  />
)
