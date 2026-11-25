import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, QrCode, Share2, Shield, UserCheck } from 'lucide-react';

interface QrShareBodyProps {
  guestMode: boolean;
  onChangeGuestMode: (guest: boolean) => void;
  onShareNative: (guest: boolean) => void;
  onNotify: (msg: string) => void;
}

export function buildDistributionUrl(guestMode: boolean): string {
  if (typeof window === 'undefined') {
    return guestMode
      ? 'https://marinevision-skikda.netlify.app/?mode=guest'
      : 'https://marinevision-skikda.netlify.app/';
  }
  const url = new URL(window.location.origin + window.location.pathname);
  if (guestMode) {
    url.searchParams.set('mode', 'guest');
  } else {
    url.searchParams.delete('mode');
  }
  return url.toString();
}

export const QrShareBody: React.FC<QrShareBodyProps> = ({
  guestMode,
  onChangeGuestMode,
  onShareNative,
  onNotify,
}) => {
  const [pngDataUrl, setPngDataUrl] = useState<string>('');

  const shareUrl = useMemo(() => buildDistributionUrl(guestMode), [guestMode]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(shareUrl, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#080f18',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setPngDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setPngDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    const a = document.createElement('a');
    a.href = pngDataUrl;
    a.download = guestMode
      ? 'marina-visionnaire-qrcode-invite.png'
      : 'marina-visionnaire-qrcode.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    onNotify('QR Code téléchargé en PNG');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      onNotify('Lien copié dans le presse-papier');
    } catch {
      onNotify('Copie manuelle disponible ci-dessous');
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChangeGuestMode(true)}
          className={`p-2.5 rounded-lg border text-left transition-colors flex items-center gap-2 ${
            guestMode
              ? 'bg-[#00f2fe]/15 border-[#00f2fe] text-[#00f2fe]'
              : 'bg-[#080f18] border-[#3a494b]/60 text-[#9eb2b8] hover:text-[#e0fdff]'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <div>
            <div className="font-semibold">Mode Invité (Client)</div>
            <div className="text-[10px] opacity-80">Interface épurée · ?mode=guest</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChangeGuestMode(false)}
          className={`p-2.5 rounded-lg border text-left transition-colors flex items-center gap-2 ${
            !guestMode
              ? 'bg-[#40dcca]/15 border-[#40dcca] text-[#40dcca]'
              : 'bg-[#080f18] border-[#3a494b]/60 text-[#9eb2b8] hover:text-[#e0fdff]'
          }`}
        >
          <Shield className="w-4 h-4 shrink-0" />
          <div>
            <div className="font-semibold">Lien Standard</div>
            <div className="text-[10px] opacity-80">Accès complet</div>
          </div>
        </button>
      </div>

      <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#080f18] border border-[#3a494b]/50 gap-3">
        {pngDataUrl ? (
          <div className="rounded-xl bg-white p-2.5 shadow-lg shadow-[#00f2fe]/10">
            <img
              src={pngDataUrl}
              alt="QR Code de distribution Marina Visionnaire"
              className="w-44 h-44 block rounded-lg"
            />
          </div>
        ) : (
          <div className="w-48 h-48 rounded-xl bg-[#151c25] flex flex-col items-center justify-center text-[#9eb2b8] gap-2">
            <QrCode className="w-8 h-8 text-[#00f2fe]" />
            <span>Génération du QR Code...</span>
          </div>
        )}
        <p className="text-[11px] text-[#9eb2b8] text-center leading-relaxed max-w-xs">
          Scannez ce QR Code avec l&apos;appareil photo d&apos;un smartphone pour ouvrir et installer{' '}
          <strong className="text-[#e0fdff]">Marina Visionnaire</strong> en PWA.
        </p>
      </div>

      <div className="p-2.5 rounded-lg bg-[#080f18] border border-[#3a494b]/60 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[#00f2fe] truncate select-all">{shareUrl}</span>
        <button
          type="button"
          onClick={handleCopyLink}
          className="px-2.5 py-1.5 rounded bg-[#19202a] hover:bg-[#232a34] border border-[#3a494b] text-[#e0fdff] text-[11px] font-medium flex items-center gap-1 shrink-0"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copier</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onShareNative(guestMode)}
          className="py-2.5 px-3 rounded-lg bg-[#00f2fe] hover:bg-[#6ff6ff] text-[#002022] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          <span>Partager (Mobile / App)</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPng}
          disabled={!pngDataUrl}
          className="py-2.5 px-3 rounded-lg bg-[#19202a] hover:bg-[#232a34] disabled:opacity-50 border border-[#40dcca]/50 text-[#40dcca] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Télécharger QR PNG</span>
        </button>
      </div>
    </div>
  );
};
