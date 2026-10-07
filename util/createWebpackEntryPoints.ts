/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */


import { findFiles } from './FindLocalModules.js'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { buildInfo } from './BuildInfo.js'

// find all files in the /entries folder
const entryNames = await findFiles('./src/frontend/entries/')

const entryConfig = Object.fromEntries(entryNames.map(
    (entry) => [ entry.replace(/\.[^.]*$/, ''), './src/frontend/entries/'+entry]))

// output HTML file name for an entry point (main app is served as SweetSpot.html)
const htmlName = (entry: string) =>
    (entry === 'LT1Main' ? 'SweetSpot' : entry) + '.html'

// for each entry point, create one webpack HTML plugin
const HtmlPlugins = entryNames.map( function(entry: string) {
    entry = entry.replace(/\.[^.]*$/, '')

    return new HtmlWebpackPlugin({
        template: './src/frontend/assets/template.ejs',
        templateParameters: {
            // the id of the div element in the template is renamed
            // so that app.mount can find it
            appid: entry,
            // version and where to report problems, shown in the footer
            build: buildInfo,
        },
        favicon: './src/frontend/assets/images/Favicon.png',
        filename: htmlName(entry),
        chunks: [entry],
    })
})

// add an index file that is shown by localhost entry
HtmlPlugins.push(new HtmlWebpackPlugin({
    template: './src/frontend/assets/index.ejs',
    templateParameters: {
        // create a list of links to all entry points
        entrypoints: "<ul>" + 
            entryNames.map(entryName => {
                const entry = entryName.replace(/\.[^.]*$/, '')
                return `<li><a href="${htmlName(entry)}">${htmlName(entry).replace(/\.html$/, '')}</a></li>`
            }).join("\n")
            + "</ul>"
    },
    favicon: './src/frontend/assets/images/Favicon.png',
    filename: 'index.html',
    // only links: loading the apps here would run all of them on one page,
    // and their live updates in development would clash
    chunks: [],
}))

export {entryConfig, HtmlPlugins}
