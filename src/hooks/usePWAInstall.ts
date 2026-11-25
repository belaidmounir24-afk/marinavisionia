import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __marineSwRegistration?: ServiceWorkerRegistration;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useServiceWorkerStatus() {
  const [swState, setSwState] = useState<'checking' | 'active' | 'unsupported' | 'error'>(() =>
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'checking' : 'unsupported'
  );
  const [lastCheckTime, setLastCheckTime] = useState<string>(() =>
    new Date().toTimeString().split(' ')[0]
  );
  const [updateFoundCount, setUpdateFoundCount] = useState(0);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwState('unsupported');
      return;
    }

    if (window.__marineSwRegistration?.active || navigator.serviceWorker.controller) {
      setSwState('active');
    }

    const onSwEvent = (ev: Event) => {
      const custom = ev as CustomEvent<{ type: string }>;
      setLastCheckTime(new Date().toTimeString().split(' ')[0]);
      if (custom.detail?.type === 'registered' || custom.detail?.type === 'controllerchange') {
        setSwState('active');
      } else if (custom.detail?.type === 'updatefound') {
        setUpdateFoundCount((n) => n + 1);
      } else if (custom.detail?.type === 'error') {
        setSwState('error');
      }
    };

    window.addEventListener('marinevision-sw-event', onSwEvent);
    navigator.serviceWorker.ready
      .then(() => setSwState('active'))
      .catch(() => setSwState('error'));

    return () => window.removeEventListener('marinevision-sw-event', onSwEvent);
  }, []);

  const forceUpdateCheck = useCallback(async () => {
    setLastCheckTime(new Date().toTimeString().split(' ')[0]);
    if (!('serviceWorker' in navigator)) {
      setSwState('unsupported');
      return { ok: false, hasUpdate: false };
    }
    try {
      const reg =
        window.__marineSwRegistration || (await navigator.serviceWorker.getRegistration('/'));
      if (!reg) {
        const fresh = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        window.__marineSwRegistration = fresh;
        setSwState('active');
        return { ok: true, hasUpdate: false };
      }
      await reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        setUpdateFoundCount((n) => n + 1);
        return { ok: true, hasUpdate: true };
      }
      setSwState('active');
      return { ok: true, hasUpdate: false };
    } catch {
      setSwState('error');
      return { ok: false, hasUpdate: false };
    }
  }, []);

  return {
    swState,
    lastCheckTime,
    updateFoundCount,
    forceUpdateCheck,
  };
}
