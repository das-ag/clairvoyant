import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Clairvoyant',
  description: 'An AI algorithm visualization app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="overflow-hidden">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={metadata.description as string} />
        <title>{metadata.title as string}</title>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.className} w-full h-dvh overflow-hidden bg-primary-100 dark:bg-primary-900 text-primary dark:text-primary-200`}>{children}</body>
    </html>
  )
}
