import { NextIntlClientProvider } from 'next-intl'
import en from '../../messages/en.json'
import zh from '../../messages/zh.json'
import StorageMigration from './StorageMigration'

const messages = { en, zh } as const

export const dynamic = 'force-static'

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh' }]
}

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const msgs = messages[locale as keyof typeof messages] || en

  return (
    <NextIntlClientProvider locale={locale} messages={msgs}>
      <StorageMigration />
      {children}
    </NextIntlClientProvider>
  )
}