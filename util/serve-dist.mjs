/**
 * Serves the production build in ./dist on http://localhost:4173 (or the
 * port given as PORT), e.g. for end-to-end tests. Development only.
 */

import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve('dist')
const port = Number(process.env.PORT ?? 4173)
const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
}

createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname)
    let file = normalize(join(root, path))
    // never serve files outside the build folder
    if (file !== root && !file.startsWith(root + sep)) {
        response.writeHead(403).end()
        return
    }
    try {
        if (statSync(file).isDirectory()) {
            file = join(file, 'index.html')
        }
        statSync(file)
    } catch {
        response.writeHead(404).end('Not found')
        return
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(response)
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`))
