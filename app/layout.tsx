import './globals.css'
import { CanvasImportWrapper } from '@/lib/CanvasImportWrapper'
import TitleBar from '@/components/TitleBar'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning>
      <body style={{ margin: 0 }}>
        <TitleBar />
        {children}
        <CanvasImportWrapper />
      </body>
    </html>
  )
}