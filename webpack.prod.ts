import { merge } from 'webpack-merge'
import common from './webpack.common.js'
import webpack from 'webpack'

export default merge(common, <webpack.Configuration>{
    // the Vue build is set in webpack.common.ts; production mode makes
    // webpack drop Vue's development-only code
    mode: 'production',
    output: {
        // content hashes in file names, so that browsers never combine
        // cached files of an older build with files of a newer one
        filename: '[name].[contenthash:8].bundle.js',
        chunkFilename: '[name].[contenthash:8].bundle.js',
    },
});
