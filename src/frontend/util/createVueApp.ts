/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import * as Vue from 'vue'
import FloatingVue from 'floating-vue'
import 'floating-vue/dist/style.css'
import { createI18n } from 'vue-i18n'

/**
 * utility function for creation of Vue app
 * @param{string} id - name of DOM element to mount app (without #)
 * @param{Vue.Component} component - main Vue component
 */
export default function(id: string, component: Vue.Component): Vue.ComponentPublicInstance {
    // create Vue app
    const app = Vue.createApp(component)

    // the app is in English only; texts are kept in the components'
    // <i18n> blocks
    const locale = "en"
    const i18n = createI18n({
        globalInjection: true,
        inheritLocale: true,
        locale,
        fallbackLocale: locale,
    })
    document.getElementsByTagName("html")[0].lang = locale
    app.use(i18n)

    // add tooltip support
    app.use(FloatingVue)

    // mount
    return app.mount('#'+id)

}
