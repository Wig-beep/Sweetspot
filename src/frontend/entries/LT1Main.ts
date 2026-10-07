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
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch((error) =>
            console.warn('SweetSpot will not work offline:', error))
    })
}
