import { NextIntlClientProvider } from 'next-intl'
import en from '../../messages/en.json'
import zh from '../../messages/zh.json'

const messages = { en, zh } as const

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const msgs = messages[locale as keyof typeof messages] || en

  return (
    <NextIntlClientProvider locale={locale} messages={msgs}>
      {children}
    </NextIntlClientProvider>
  )
}