import React from 'react'

export const metadata = {
  title: 'AntBuddy Zalo Mini App — Backend',
  description: 'Payload backend cho Zalo Mini App TMĐT',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
