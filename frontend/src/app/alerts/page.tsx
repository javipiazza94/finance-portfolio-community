'use client';

import { useEffect, useState } from 'react';
import { fetchAlerts, fetchVapidKey, subscribePush } from '@/lib/api';
import { BellRing, Activity, AlertTriangle, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts()
      .then(data => {
        setAlerts(data || []);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleSubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Tu navegador no soporta Notificaciones Push.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permiso denegado para mostrar notificaciones.');
        return;
      }

      // Register SW and wait for it to become active before subscribing
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;

      const { key } = await fetchVapidKey();
      const applicationServerKey = urlBase64ToUint8Array(key);

      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Reuse existing subscription
        await subscription.unsubscribe();
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subData = JSON.parse(JSON.stringify(subscription));
      await subscribePush({
        endpoint: subData.endpoint,
        p256dh: subData.keys.p256dh,
        auth: subData.keys.auth,
      });

      alert('¡Suscripción a alertas completada con éxito!');
    } catch (e: any) {
      console.error('[push]', e);
      if (e?.name === 'AbortError') {
        const isChrome = navigator.userAgent.includes('Chrome');
        const isSnap = navigator.userAgent.includes('Chromium');
        const msg = (isChrome || isSnap)
          ? 'Chromium instalado como Snap no soporta notificaciones push (sandbox restriction).\n\nSoluciones:\n• Usa Firefox\n• Instala Chromium como paquete .deb (no snap)'
          : 'Firefox no pudo conectar con el servicio push de Mozilla.\n\nComprueba en about:config:\n• dom.push.enabled = true\n• dom.push.connection.enabled = true';
        alert(msg);
      } else {
        alert(`Error al configurar notificaciones: ${e?.message || e}`);
      }
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-text-muted"><Activity className="w-5 h-5 animate-spin" /> Cargando alertas...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centro de Alertas</h1>
          <p className="text-text-muted mt-2">Notificaciones de mercado y señales técnicas en tiempo real.</p>
        </div>
        <button 
          onClick={handleSubscribe}
          className="bg-surface-hover border border-[var(--color-border)] text-text-main px-4 py-2 rounded-lg text-sm hover:text-primary transition-colors flex items-center"
        >
          <BellRing className="w-4 h-4 mr-2" /> Activar Notificaciones Push
        </button>
      </header>

      {alerts.length === 0 ? (
        <div className="glass-panel p-12 text-center flex flex-col items-center">
          <AlertTriangle className="w-12 h-12 text-text-muted mb-4 opacity-50" />
          <h3 className="text-xl font-medium">No hay alertas recientes</h3>
          <p className="text-text-muted mt-2">El sistema de análisis aún no ha detectado señales fuertes en el mercado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert: any, index: number) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={alert.id} 
              className="glass-panel p-5 flex items-start gap-4 border-l-4"
              style={{ borderLeftColor: alert.alert_type === 'BUY' ? 'var(--color-success)' : alert.alert_type === 'SELL' ? 'var(--color-danger)' : 'var(--color-secondary)' }}
            >
              <div className={`p-3 rounded-xl bg-surface-hover ${alert.alert_type === 'BUY' ? 'text-success' : alert.alert_type === 'SELL' ? 'text-danger' : 'text-secondary'}`}>
                {alert.alert_type === 'BUY' ? <TrendingUp className="w-6 h-6" /> : alert.alert_type === 'SELL' ? <TrendingDown className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{alert.ticker} <span className="text-text-muted text-sm font-normal ml-2">{alert.asset_name}</span></h3>
                    <p className="text-text-main mt-1">{alert.detail}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-mono">${(alert.price || 0).toFixed(2)}</span>
                    <div className="text-xs text-text-muted flex items-center justify-end mt-1">
                      <Clock className="w-3 h-3 mr-1" />
                      {alert.triggered_at ? new Date(alert.triggered_at).toLocaleString() : 'Reciente'}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
