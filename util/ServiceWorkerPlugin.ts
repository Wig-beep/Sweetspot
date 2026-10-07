/**
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import webpack from 'webpack'

/**
 * Emits the service worker of an app (see
 * src/frontend/assets/service-worker.js) with the list of files to keep
 * offline: the app's page and every file webpack loads for its entry point,
 * including chunks loaded later (models, sensors) and its Web Workers, plus
 * the given static files.
 */
export default class ServiceWorkerPlugin {
    constructor(private options: {
        /** name of the entry point, e.g. LT1Main */
        entry: string
        /** file name of the app's page, e.g. SweetSpot.html */
        page: string
        /** service worker template */
        template: string
        /** other files to keep, e.g. styles and icons */
        files: string[]
    }) { }

    apply(compiler: webpack.Compiler) {
        compiler.hooks.thisCompilation.tap("ServiceWorkerPlugin", (compilation) => {
            compilation.hooks.processAssets.tap({
                name: "ServiceWorkerPlugin",
                stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
            }, () => {
                const entry = compilation.entrypoints.get(this.options.entry)
                if (!entry) {
                    throw new Error(`entry point ${this.options.entry} not found`)
                }
                // the entry point and every chunk group it loads later:
                // dynamic imports and Web Workers (started by modules)
                const files = new Set<string>()
                const visited = new Set<webpack.ChunkGroup>()
                const visitBlocks = (block: { blocks: webpack.AsyncDependenciesBlock[] }) => {
                    for (const child of block.blocks) {
                        const group = compilation.chunkGraph.getBlockChunkGroup(child)
                        if (group) visit(group)
                        visitBlocks(child)
                    }
                }
                const visit = (group: webpack.ChunkGroup) => {
                    if (visited.has(group)) return
                    visited.add(group)
                    for (const chunk of group.chunks) {
                        chunk.files.forEach((file) => files.add(file))
                        for (const module of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
                            visitBlocks(module)
                        }
                    }
                    group.getChildren().forEach(visit)
                }
                visit(entry)
                // chunks the visited chunks load on demand (e.g. models)
                for (const group of visited) {
                    for (const chunk of group.chunks) {
                        for (const async of chunk.getAllAsyncChunks()) {
                            async.files.forEach((file) => files.add(file))
                        }
                    }
                }

                const precache = [this.options.page, ...this.options.files,
                    ...[...files].filter((file) => !file.endsWith(".map")).sort()]
                // a new version whenever any of the files changes, also files
                // without a content hash in their name (e.g. styles)
                const hash = createHash("sha256")
                for (const file of precache) {
                    const asset = compilation.getAsset(file)
                    if (!asset) {
                        throw new Error(`file to keep offline not found: ${file}`)
                    }
                    hash.update(file).update(asset.source.buffer())
                }
                const version = hash.digest("hex").slice(0, 12)
                const source = `self.__SWEETSPOT_VERSION = ${JSON.stringify(version)}\n`
                    + `self.__SWEETSPOT_PRECACHE = ${JSON.stringify(precache, null, 1)}\n\n`
                    + readFileSync(this.options.template, "utf8")
                compilation.emitAsset("service-worker.js",
                    new webpack.sources.RawSource(source))
            })
        })
    }
}
