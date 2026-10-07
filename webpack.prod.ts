import { merge } from 'webpack-merge'
import common from './webpack.common.js'
import webpack from 'webpack'
import ServiceWorkerPlugin from './util/ServiceWorkerPlugin.js'

export default merge(common, <webpack.Configuration>{
    // the Vue build is set in webpack.common.ts; production mode makes
    // webpack drop Vue's development-only code
    mode: 'production',
    output: {
        // content hashes in file names, so that browsers never combine
        // cached files of an older build with files of a newer one
        filename: '[name].[contenthash:8].bundle.js',
        chunkFilename: '[name].[contenthash:8].bundle.js',
        // remove files of earlier builds, which would otherwise pile up
        clean: true,
    },
    plugins: [
        // SweetSpot works offline once it has been opened (production only)
        new ServiceWorkerPlugin({
            entry: 'LT1Main',
            page: 'SweetSpot.html',
            template: './src/frontend/assets/service-worker.js',
            files: [
                'manifest.webmanifest',
                'styles/LT1style.css',
                'Favicon.png',
                'images/icons/icon-192.png',
                'images/icons/icon-512.png',
                'images/icons/icon-maskable-512.png',
                'images/icons/apple-touch-icon.png',
            ],
        }),
    ],
});
