/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import vue from '@vitejs/plugin-vue'
import { defineConfig, Plugin } from 'vitest/config'

/**
 * Unit tests of the Vue components (test/components/*.spec.ts), run with
 * `npm run test:components`. The other unit tests run with mocha.
 */

/**
 * Makes the texts of <i18n> blocks available to the components, as
 * $options.__i18nMessages (see test/components/setup.ts); the app uses
 * vue-i18n for this.
 */
const i18nBlocks: Plugin = {
    name: 'sweetspot-i18n-blocks',
    transform(code, id) {
        if (!/[?&]type=i18n/.test(id)) return
        return `const messages = (${code});
export default function (component) { component.__i18nMessages = messages }`
    },
}

export default defineConfig({
    plugins: [vue(), i18nBlocks],
    define: {
        __SWEETSPOT_BUILD__: JSON.stringify({
            version: '0.0.0 (test)', personalData: true, feedbackUrl: '',
            stylesheet: './styles/LT1style.css',
        }),
    },
    test: {
        environment: 'happy-dom',
        include: ['test/components/**/*.spec.ts'],
        setupFiles: ['test/components/setup.ts'],
    },
})
