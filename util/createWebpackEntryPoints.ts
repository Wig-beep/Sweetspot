/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */


import { findFiles } from './FindLocalModules.js'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { readFileSync } from 'fs'
import { buildInfo } from './BuildInfo.js'

/**
 * Production builds contain SweetSpot only, which is the software that is
 * deployed and assessed (see docs/clinical-safety). The other pages (model
 * and controller structure, simple demo) are for development; they are
 * included in development, or with SWEETSPOT_ALL_PAGES=on.
 */
const onlySweetSpot = process.env.NODE_ENV === 'production'
    && process.env.SWEETSPOT_ALL_PAGES !== 'on'

// find all files in the /entries folder
const entryNames = (await findFiles('./src/frontend/entries/')).filter(
    (entry) => !onlySweetSpot || entry.replace(/\.[^.]*$/, '') === 'LT1Main')

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
            + "</ul>",
        // with only SweetSpot in the build, the start page leads straight to it
        redirect: onlySweetSpot ? htmlName('LT1Main') : '',
        build: buildInfo,
    },
    favicon: './src/frontend/assets/images/Favicon.png',
    filename: 'index.html',
    // only links: loading the apps here would run all of them on one page,
    // and their live updates in development would clash
    chunks: [],
}))

// pages of text: accessibility statement and privacy notice (in every
// build); {{version}} and {{contact}} are filled in for the build
const contact = buildInfo.feedbackUrl
    ? `<a href="${buildInfo.feedbackUrl}">contact the SweetSpot team</a>`
    : 'tell your diabetes educator'
for (const [name, title] of [['accessibility', 'Accessibility statement'], ['privacy', 'Privacy']]) {
    const content = readFileSync(`./src/frontend/assets/pages/${name}.html`, 'utf8')
        .replaceAll('{{version}}', buildInfo.version)
        .replaceAll('{{contact}}', contact)
    HtmlPlugins.push(new HtmlWebpackPlugin({
        template: './src/frontend/assets/page.ejs',
        templateParameters: { build: buildInfo, title, content },
        favicon: './src/frontend/assets/images/Favicon.png',
        filename: `${name}.html`,
        chunks: [],
    }))
}

export {entryConfig, HtmlPlugins}
