import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Monitor, QrCode, X, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import QRCodeLib from 'qrcode'

const APP_URL = 'https://udl-games.vercel.app'

export function FloatingAdminButtons() {
  const { isAdmin } = useAuth()
  const [showQR, setShowQR] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!showQR) return
    QRCodeLib.toDataURL(APP_URL, {
      width: 280,
      margin: 2,
      color: { dark: '#ffffff', light: '#0a0a0a' },
    }).then(setQrDataUrl)
  }, [showQR])

  const handleCopy = () => {
    navigator.clipboard.writeText(APP_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isAdmin) return null

  return (
    <>
      {/* Floating buttons */}
      <div className="fixed bottom-6 right-4 z-40 flex flex-col gap-2">
        <Link to="/display" target="_blank">
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-full bg-card/80 backdrop-blur-sm shadow-lg border-border hover:border-primary/50 hover:text-primary"
            title="TV-visning"
          >
            <Monitor className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          size="icon"
          variant="outline"
          className="h-10 w-10 rounded-full bg-card/80 backdrop-blur-sm shadow-lg border-border hover:border-primary/50 hover:text-primary"
          onClick={() => setShowQR(true)}
          title="Del QR-kode"
        >
          <QrCode className="h-4 w-4" />
        </Button>
      </div>

      {/* QR modal */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 space-y-4 w-80 animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display tracking-wider">Del resultater</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowQR(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code" className="w-full rounded-lg" />
            ) : (
              <div className="w-full aspect-square bg-secondary rounded-lg animate-pulse" />
            )}
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <span className="flex-1 font-mono text-xs text-muted-foreground truncate">{APP_URL}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
