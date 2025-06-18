import "./globals.css";
import { Public_Sans } from "next/font/google";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const publicSans = Public_Sans({ subsets: ["latin"] });

const Logo = () => (
  <div className="text-2xl font-bold">Therapy Copilot</div>
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Therapist AI Assistant</title>
        <link rel="shortcut icon" href="/images/favicon.ico" />
        <meta
          name="description"
          content="An AI assistant for therapists using live transcription."
        />
        <meta property="og:title" content="Therapist AI Assistant" />
        <meta
          property="og:description"
          content="An AI assistant for therapists using live transcription."
        />
        <meta property="og:image" content="/images/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Therapist AI Assistant" />
        <meta
          name="twitter:description"
          content="An AI assistant for therapists using live transcription."
        />
        <meta name="twitter:image" content="/images/og-image.png" />
      </head>
      <body className={publicSans.className}>
        <NuqsAdapter>
          <div className="bg-secondary grid grid-rows-[auto,1fr] h-[100dvh]">
            <header className="flex items-center justify-between gap-4 p-4">
              <Logo />
              <Button asChild variant="outline" size="sm">
                <a
                  href="https://github.com/langchain-ai/langchain-nextjs-template"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GithubIcon className="mr-2 size-4" />
                  <span>View on GitHub</span>
                </a>
              </Button>
            </header>
            <main className="bg-background mx-4 relative grid rounded-t-2xl border border-input border-b-0">
              <div className="absolute inset-0">{children}</div>
            </main>
          </div>
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
