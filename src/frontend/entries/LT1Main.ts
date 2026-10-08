/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import LT1Main from '../LT1Main/LT1Main.vue'
import createVueApp from '../util/createVueApp.js'

createVueApp('LT1Main', LT1Main)

// keep the app on the device, so that it works offline (the service worker
// is only part of production builds)
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // an older version kept on the device opened this page: new versions
    // found now are updates (on a first visit, there is nothing to update)
    const hadOlderVersion = navigator.serviceWorker.controller !== null
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js')
            if (hadOlderVersion) {
                watchForUpdates(registration)
            }
        } catch (error) {
            console.warn('SweetSpot will not work offline:', error)
        }
    })
}

/**
 * Tells the page (event 'sweetspot-update-ready') when a new version has been
 * stored and is waiting. When the page asks for it (event
 * 'sweetspot-use-update'), the new version takes over and the page is loaded
 * again with it.
 */
function watchForUpdates(registration: ServiceWorkerRegistration) {
    let waiting: ServiceWorker | null = null
    const announce = (worker: ServiceWorker) => {
        waiting = worker
        window.dispatchEvent(new CustomEvent('sweetspot-update-ready'))
    }
    // a new version found on an earlier visit, still waiting
    if (registration.waiting) {
        announce(registration.waiting)
    }
    registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
                announce(worker)
            }
        })
    })
    let updating = false
    window.addEventListener('sweetspot-use-update', () => {
        if (waiting) {
            updating = true
            waiting.postMessage({ type: 'SKIP_WAITING' })
        }
    })
    // only reload for an update the user asked for (on a first visit the
    // service worker also takes control, which needs no reload)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updating) {
            updating = false
            window.location.reload()
        }
    })
}
