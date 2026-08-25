'use client'

/**
 * Enregistre le service worker PWA.
 * Placé dans le layout server — ce composant client s'exécute
 * uniquement dans le navigateur après hydratation.
 */
import { useEffect } from 'react'

export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Attendre le chargement complet avant d'enregistrer
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register)
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}

function register() {
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      // Vérifier les mises à jour toutes les heures
      setInterval(() => {
        registration.update().catch(() => {})
      }, 60 * 60 * 1000)

      // Écouter les mises à jour du service worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            // Nouveau SW actifié — on peut informer l'utilisateur
            console.log('[PWA] New version available')
          }
        })
      })
    })
    .catch((err) => {
      // L'enregistrement échoue silencieusement (mode dev sans HTTPS, etc.)
      console.debug('[PWA] Registration failed:', err)
    })
}
