import React from 'react'

const LOGO_URL = 'https://logo-zp.zdn.vn/app/8164ce37f072192c4063_2_1.jpg'

// Logo hiển thị ở màn đăng nhập admin (kích thước lớn).
export const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <img src={LOGO_URL} alt="AntD2C" height={56} style={{ borderRadius: 8 }} />
    <span style={{ fontSize: 28, fontWeight: 700 }}>AntD2C</span>
  </div>
)

// Icon hiển thị ở góc trên thanh điều hướng admin (kích thước nhỏ).
export const Icon = () => (
  <img src={LOGO_URL} alt="AntD2C" height={28} style={{ borderRadius: 6 }} />
)
