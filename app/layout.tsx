import './globals.css'
import { CanvasImportWrapper } from '@/lib/CanvasImportWrapper'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning>
      <body>
        {children}
        <CanvasImportWrapper />
      </body>
    </html>
  )
}