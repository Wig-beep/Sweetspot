/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { config } from '@vue/test-utils'
import { App } from 'vue'

/** $t with the texts of the component's <i18n> block (see vitest.config.ts) */
config.global.plugins.push({
    install(app: App) {
        app.config.globalProperties.$t = function (this: { $options: { __i18nMessages?: Record<string, string> } }, key: string) {
            return this.$options.__i18nMessages?.[key] ?? key
        }
    },
})
